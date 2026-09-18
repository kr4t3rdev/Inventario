/**
 * @description Tests de copy neutral en los handlers públicos de auth/onboarding
 * (PE-01), con el cliente Prisma mockeado para aislar el flujo de registro.
 * @module src/features/auth/__tests__/handlers-onboarding.test
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mock del cliente Prisma ────────────────────────────────────────────────

const { scopedMock, platformMock } = vi.hoisted(() => {
	const buildClientMock = () => ({
		user: {
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
			findMany: vi.fn(),
		},
		affiliateProfile: { findUnique: vi.fn() },
		salesAgentProfile: {
			findUnique: vi.fn(),
			updateMany: vi.fn(),
			create: vi.fn(),
		},
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
	return {
		scopedMock: buildClientMock(),
		platformMock: buildClientMock(),
	};
});

vi.mock('@/lib/prisma', () => ({ prisma: scopedMock }));
vi.mock('@/lib/db/platform-prisma', () => ({
	prismaPlatform: platformMock,
	default: platformMock,
}));

// ─── Mocks de colaboradores ─────────────────────────────────────────────────

vi.mock('@/lib/auth-middleware', () => ({
	authenticateUser: vi.fn(),
	resolveTenantContext: vi.fn(),
}));

vi.mock('@/lib/auth/onboarding', () => ({
	signOnboardingToken: vi.fn(() => 'onboarding-token-mock'),
	verifyOnboardingToken: vi.fn(),
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
import { verifyOnboardingToken } from '@/lib/auth/onboarding';
import { checkRateLimit } from '@/lib/rate-limit';
import { onboardingMe, onboardingTenant, onboardingType, register } from '../api/handlers';

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
	vi.stubEnv('TENANT_ISOLATION_MODE', 'enforce');
});

afterEach(() => {
	vi.unstubAllEnvs();
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

describe('onboarding — cliente platform (PE-02)', () => {
	it('register con referido consulta perfiles únicamente en prismaPlatform', async () => {
		scopedMock.user.findUnique.mockResolvedValue(null);
		scopedMock.user.create.mockResolvedValue({ userId: 'user-referral' });
		platformMock.affiliateProfile.findUnique.mockResolvedValue({
			affiliateProfileId: 'affiliate-1',
			isEligible: true,
			status: 'active',
		});
		platformMock.salesAgentProfile.findUnique.mockResolvedValue(null);
		vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);

		const res = await register(
			buildRequest('/api/auth/register', {
				name: 'Ana',
				email: 'ana-referral@example.com',
				password: 'secret123',
				referralCode: 'AFFILIATE-1',
			}),
		);

		expect(res.status).toBe(200);
		expect(platformMock.affiliateProfile.findUnique).toHaveBeenCalledWith(
			expect.objectContaining({ where: { referralCode: 'AFFILIATE-1' } }),
		);
		expect(platformMock.salesAgentProfile.findUnique).toHaveBeenCalled();
		expect(scopedMock.affiliateProfile.findUnique).not.toHaveBeenCalled();
		expect(scopedMock.salesAgentProfile.findUnique).not.toHaveBeenCalled();
	});

	it('onboardingType salesAgent ejecuta la transacción completa en prismaPlatform', async () => {
		vi.mocked(verifyOnboardingToken).mockReturnValue({
			userId: 'user-sales-agent',
			purpose: 'onboarding',
		} as never);
		platformMock.$transaction.mockImplementation(async (callback) => callback(platformMock));
		platformMock.user.findUnique.mockResolvedValue({
			isActive: false,
			onboardingStatus: 'selecting_user_type',
		});
		platformMock.tenantMembership.count.mockResolvedValue(0);
		platformMock.salesAgentProfile.findUnique.mockResolvedValue(null);
		platformMock.salesAgentProfile.create.mockResolvedValue({});
		platformMock.tenantMembership.deleteMany.mockResolvedValue({ count: 0 });
		platformMock.user.update.mockResolvedValue({});

		const res = await onboardingType(
			buildRequest(
				'/api/auth/onboarding/type',
				{ userType: 'salesAgent', phone: '+5355555555' },
				{ authorization: 'Bearer onboarding-token' },
			),
		);

		expect(res.status).toBe(200);
		expect(platformMock.$transaction).toHaveBeenCalled();
		expect(scopedMock.$transaction).not.toHaveBeenCalled();
		expect(platformMock.tenantMembership.count).toHaveBeenCalled();
		expect(platformMock.tenantMembership.deleteMany).toHaveBeenCalled();
		expect(scopedMock.tenantMembership.count).not.toHaveBeenCalled();
	});

	it('onboardingTenant usa prismaPlatform para todas las membresías', async () => {
		vi.mocked(verifyOnboardingToken).mockReturnValue({
			userId: 'user-worker',
			purpose: 'onboarding',
		} as never);
		scopedMock.user.findUnique.mockResolvedValue({
			userId: 'user-worker',
			name: 'Ana',
			onboardingType: 'worker',
			onboardingStatus: 'selecting_tenant',
		});
		scopedMock.tenant.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
		platformMock.tenantMembership.count.mockResolvedValue(0);
		platformMock.tenantMembership.upsert.mockResolvedValue({
			membershipId: 'membership-1',
		});
		platformMock.tenantMembership.findMany.mockResolvedValue([]);

		const res = await onboardingTenant(
			buildRequest(
				'/api/auth/onboarding/tenant',
				{ tenantId: 'tenant-1' },
				{ authorization: 'Bearer onboarding-token' },
			),
		);

		expect(res.status).toBe(200);
		expect(platformMock.tenantMembership.count).toHaveBeenCalled();
		expect(platformMock.tenantMembership.upsert).toHaveBeenCalled();
		expect(platformMock.tenantMembership.findMany).toHaveBeenCalled();
		expect(scopedMock.tenantMembership.count).not.toHaveBeenCalled();
		expect(scopedMock.tenantMembership.upsert).not.toHaveBeenCalled();
		expect(scopedMock.tenantMembership.findMany).not.toHaveBeenCalled();
	});

	it('onboardingMe consulta el conteo de membresías únicamente en prismaPlatform', async () => {
		vi.mocked(verifyOnboardingToken).mockReturnValue({
			userId: 'user-worker',
			purpose: 'onboarding',
		} as never);
		scopedMock.user.findUnique.mockResolvedValue({
			userId: 'user-worker',
			name: 'Ana',
			email: 'ana@example.com',
			role: 'user',
			isActive: false,
			onboardingType: 'worker',
			onboardingStatus: 'selecting_tenant',
			emailVerifiedAt: new Date(),
		});
		scopedMock.tenant.findMany.mockResolvedValue([]);
		scopedMock.moneda.findMany.mockResolvedValue([]);
		platformMock.tenantMembership.count.mockResolvedValue(0);

		const res = await onboardingMe(
			buildRequest(
				'/api/auth/onboarding/me',
				{},
				{ authorization: 'Bearer onboarding-token' },
			),
		);

		expect(res.status).toBe(200);
		expect(platformMock.tenantMembership.count).toHaveBeenCalled();
		expect(scopedMock.tenantMembership.count).not.toHaveBeenCalled();
	});
});
