/**
 * @description Tests de copy neutral en los handlers públicos de auth/onboarding
 * (PE-01), con el cliente Prisma mockeado para aislar el flujo de registro.
 * @module src/features/auth/__tests__/handlers-onboarding.test
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mock del cliente Prisma ────────────────────────────────────────────────

const { scopedMock } = vi.hoisted(() => {
	const buildClientMock = () => ({
		user: {
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
			findMany: vi.fn(),
		},
		affiliateProfile: { findUnique: vi.fn() },
		salesAgentProfile: { findUnique: vi.fn() },
		tenant: { findUnique: vi.fn(), findMany: vi.fn() },
		tenantMembership: {
			count: vi.fn(),
			upsert: vi.fn(),
			findUnique: vi.fn(),
			findMany: vi.fn(),
			deleteMany: vi.fn(),
		},
		moneda: { findUnique: vi.fn(), findMany: vi.fn() },
		notification: { create: vi.fn() },
		userSession: {
			create: vi.fn(),
			updateMany: vi.fn(),
			findFirst: vi.fn(),
			deleteMany: vi.fn(),
		},
		userActivityLog: { create: vi.fn() },
		$transaction: vi.fn(),
	});
	return { scopedMock: buildClientMock() };
});

vi.mock('@/lib/prisma', () => ({ prisma: scopedMock }));

// ─── Mocks de colaboradores ─────────────────────────────────────────────────

vi.mock('@/lib/auth-middleware', () => ({
	authenticateUser: vi.fn(),
	resolveTenantContext: vi.fn(),
}));

vi.mock('@/lib/auth/onboarding', () => ({
	signOnboardingToken: vi.fn(() => 'onboarding-token-mock'),
	validateCSRF: vi.fn(() => ({ valid: true })),
}));

vi.mock('@/lib/rate-limit', () => ({
	checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 4 })),
}));

vi.mock('@/lib/email', () => ({
	sendFailedLoginAttemptsNotification: vi.fn(),
	sendEmailVerificationLink: vi.fn(() =>
		Promise.resolve({ success: true, messageId: 'msg-1' }),
	),
}));

vi.mock('@/lib/secrets', () => ({
	getJwtSecret: vi.fn(() => 'test-secret'),
	getRefreshJwtSecret: vi.fn(() => 'test-refresh-secret'),
}));

vi.mock('@/features/sales-agent/public-url', () => ({
	getConfiguredPublicAppUrl: vi.fn(() => 'https://app.test'),
}));

vi.mock('bcryptjs', () => ({
	default: { compare: vi.fn(), hash: vi.fn() },
	compare: vi.fn(),
	hash: vi.fn(),
}));

import bcrypt from 'bcryptjs';
import { checkRateLimit } from '@/lib/rate-limit';
import { register } from '../api/handlers';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * @description Construye un NextRequest JSON con los headers del flujo onboarding.
 * @param {string} path - Ruta del endpoint.
 * @param {Record<string, unknown>} body - Cuerpo JSON.
 * @param {Record<string, string>} [headers] - Headers extra (p. ej. Bearer).
 * @returns {NextRequest} Request lista para el handler.
 */
function buildRequest(
	path: string,
	body: Record<string, unknown>,
	headers: Record<string, string> = {},
): NextRequest {
	return new NextRequest(`http://localhost:3000${path}`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-forwarded-for': '203.0.113.10',
			'x-request-id': 'req-test-1',
			...headers,
		},
		body: JSON.stringify(body),
	});
}

beforeEach(() => {
	vi.clearAllMocks();
});

// ─── PE-01: copy neutro en mensajes devueltos ───────────────────────────────

describe('register — copy neutro (PE-01)', () => {
	it('rate limit responde "Inténtalo" con tilde y sin voseo', async () => {
		vi.mocked(checkRateLimit).mockReturnValueOnce({
			allowed: false,
			remaining: 0,
		});

		const res = await register(
			buildRequest('/api/auth/register', {
				name: 'Ana',
				email: 'ana@example.com',
				password: 'secret123',
			}),
		);

		expect(res.status).toBe(429);
		const body = await res.json();
		expect(body.error).toBe(
			'Demasiados intentos. Inténtalo de nuevo en unos segundos.',
		);
	});

	it('registro exitoso pide "Revisa tu correo" (sin voseo)', async () => {
		scopedMock.user.findUnique.mockResolvedValue(null);
		vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
		scopedMock.user.create.mockResolvedValue({ userId: 'user-new' });

		const res = await register(
			buildRequest('/api/auth/register', {
				name: 'Ana',
				email: 'ana@example.com',
				password: 'secret123',
			}),
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.message).toBe(
			'Revisa tu correo para verificar la cuenta y continuar con el onboarding',
		);
	});
});
