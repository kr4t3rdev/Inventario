import { timingSafeEqual } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { withAction } from '@/lib/server-actions/with-action';
import { ActionError } from '@/lib/server-actions/types';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_FORM_BYTES = 4_096;
const MAX_PROBE_TTL_MS = 30 * 60_000;
export const runtime = 'nodejs';
const PRIVATE_HEADERS = {
	'Cache-Control': 'no-store, private, max-age=0',
	'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
	'Pragma': 'no-cache',
	'Referrer-Policy': 'no-referrer',
	'X-Content-Type-Options': 'nosniff',
};

/**
 * @description Renders the protected browser form for a temporary Sentry smoke test.
 * @returns {Promise<NextResponse>} No-store form, or generic not-found/unauthorized response.
 */
export async function GET(): Promise<NextResponse> {
	if (!hasRequiredConfiguration()) return privateResponse(null, 404);
	const user = await getCurrentUser();
	if (!user) return privateResponse(null, 401);
	if (user.role !== 'admin' || user.isActive !== true) return privateResponse(null, 403);

	return privateResponse(
		'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Protected Sentry smoke test</title><main><h1>Protected Sentry smoke test</h1><form method="post" enctype="application/x-www-form-urlencoded"><label for="token">Temporary smoke token</label><input id="token" name="token" type="password" autocomplete="off" required><button type="submit">Run smoke test</button></form></main></html>',
		200,
		'text/html; charset=utf-8',
	);
}

/**
 * @description Runs the authenticated withAction failure after validating Origin and the private token.
 * @param {Request} request - Same-origin form submission.
 * @returns {Promise<NextResponse>} Generic delivery status without exception details.
 */
export async function POST(request: Request): Promise<NextResponse> {
	if (!hasRequiredConfiguration()) return privateResponse(null, 404);
	if (!hasExactOrigin(request)) return privateResponse(null, 403);
	if (!isUrlEncoded(request)) return privateResponse(null, 415);

	const bodyResult = await readBodyAtMost(request, MAX_FORM_BYTES);
	if (bodyResult.kind === 'too-large') return privateResponse(null, 413);
	if (bodyResult.kind === 'invalid-encoding') return privateResponse(null, 400);

	const form = new URLSearchParams(bodyResult.body);
	const tokens = form.getAll('token');
	if (tokens.length !== 1) return privateResponse('Invalid smoke token.', 403);
	const suppliedToken = tokens[0];
	const browserUser = await getCurrentUser();
	if (!browserUser) return privateResponse(null, 401);
	if (browserUser.role !== 'admin' || browserUser.isActive !== true) {
		return privateResponse(null, 403);
	}
	const rateLimit = checkRateLimit(browserUser.userId, '/api/sentry-smoke');
	if (!rateLimit.allowed) return privateResponse(null, 429);

	const expectedToken = process.env.SENTRY_SMOKE_TOKEN!;
	if (!hasValidTokenLength(suppliedToken) || !hasMatchingToken(suppliedToken, expectedToken)) {
		return privateResponse('Invalid smoke token.', 403, 'text/plain; charset=utf-8');
	}

	const action = withAction<void, never>(async (_input, user) => {
		if (user.role !== 'admin' || user.isActive !== true) {
			throw new ActionError('Forbidden', 'FORBIDDEN');
		}
		throw new Error('Protected Sentry smoke test exception');
	});
	const result = await action();
	if (result.success) return privateResponse(null, 500);
	if (result.error.code === 'AUTH_REQUIRED') return privateResponse(null, 401);
	if (result.error.code === 'FORBIDDEN') return privateResponse(null, 403);
	if (result.error.code !== 'INTERNAL_ERROR') return privateResponse(null, 500);

	const flushed = await Sentry.flush(2_000);
	if (!flushed) return privateResponse(null, 503);

	return privateResponse('Sentry smoke event accepted.', 202, 'text/plain; charset=utf-8');
}

/**
 * @description Configures the exact lifetime of the temporary endpoint.
 * @returns {boolean} Whether the expiry timestamp is valid and still in the future.
 */
function hasUnexpiredConfiguration(): boolean {
	const expiry = process.env.SENTRY_SMOKE_EXPIRES_AT;
	if (!expiry) return false;
	const expiryMs = Date.parse(expiry);
	const now = Date.now();
	return (
		Number.isFinite(expiryMs) &&
		new Date(expiryMs).toISOString() === expiry &&
		expiryMs > now &&
		expiryMs <= now + MAX_PROBE_TTL_MS
	);
}

/**
 * @description Confirms all environment gates needed for safe, useful test delivery.
 * @returns {boolean} Whether the probe is fully configured and unexpired.
 */
function hasRequiredConfiguration(): boolean {
	const configuredOrigin = process.env.SENTRY_SMOKE_ORIGIN;
	const token = process.env.SENTRY_SMOKE_TOKEN;
	if (!token || !hasValidTokenLength(token) || !process.env.SENTRY_DSN) return false;
	if (process.env.SENTRY_ENABLE_LOGS !== 'true' || !configuredOrigin) return false;
	if (!hasUnexpiredConfiguration()) return false;
	try {
		return new URL(configuredOrigin).origin === configuredOrigin;
	} catch {
		return false;
	}
}

/**
 * @description Requires an exact origin match to prevent cross-site form submissions.
 * @param {Request} request - Incoming form request.
 * @returns {boolean} Whether the request origin exactly matches configured origin.
 */
function hasExactOrigin(request: Request): boolean {
	return request.headers.get('origin') === process.env.SENTRY_SMOKE_ORIGIN;
}

/**
 * @description Restricts POST content to URL-encoded form data.
 * @param {Request} request - Incoming form request.
 * @returns {boolean} Whether the media type is accepted.
 */
function isUrlEncoded(request: Request): boolean {
	return request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ===
		'application/x-www-form-urlencoded';
}

/**
 * @description Reads a request body with a strict byte limit, including chunked requests.
 * @param {Request} request - Incoming form request.
 * @param {number} limit - Maximum accepted bytes.
 * @returns {Promise<BodyReadResult>} UTF-8 body or a controlled parsing failure.
 */
type BodyReadResult =
	| { kind: 'ok'; body: string }
	| { kind: 'too-large' }
	| { kind: 'invalid-encoding' };

async function readBodyAtMost(request: Request, limit: number): Promise<BodyReadResult> {
	const declaredLength = Number(request.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > limit) return { kind: 'too-large' };
	if (!request.body) return { kind: 'ok', body: '' };

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		totalBytes += value.byteLength;
		if (totalBytes > limit) {
			await reader.cancel();
			return { kind: 'too-large' };
		}
		chunks.push(value);
	}

	const bytes = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	try {
		return { kind: 'ok', body: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
	} catch {
		return { kind: 'invalid-encoding' };
	}
}

/**
 * @description Accepts only bounded temporary credentials.
 * @param {string} token - Token to validate.
 * @returns {boolean} Whether token is between 32 and 256 UTF-8 bytes.
 */
function hasValidTokenLength(token: string): boolean {
	const byteLength = Buffer.byteLength(token, 'utf8');
	return byteLength >= 32 && byteLength <= 256;
}

/**
 * @description Compares non-empty tokens without content-dependent timing leakage.
 * @param {string} supplied - Submitted temporary token.
 * @param {string} expected - Configured temporary token.
 * @returns {boolean} Whether the tokens match.
 */
function hasMatchingToken(supplied: string, expected: string): boolean {
	const suppliedBuffer = Buffer.from(supplied);
	const expectedBuffer = Buffer.from(expected);
	return (
		suppliedBuffer.length > 0 &&
		suppliedBuffer.length === expectedBuffer.length &&
		timingSafeEqual(suppliedBuffer, expectedBuffer)
	);
}

/**
 * @description Builds a response with conservative cache and content-security headers.
 * @param {string | null} body - Static response body.
 * @param {number} status - HTTP status.
 * @param {string} [contentType] - Explicit response media type.
 * @returns {NextResponse} Private, non-cacheable response.
 */
function privateResponse(
	body: string | null,
	status: number,
	contentType = 'text/plain; charset=utf-8',
): NextResponse {
	return new NextResponse(body, {
		status,
		headers: { ...PRIVATE_HEADERS, 'Content-Type': contentType },
	});
}
