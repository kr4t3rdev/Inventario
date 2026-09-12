/**
 * @description Tests de AuthService para copy neutro (PE-01), con Prisma
 * mockeado para aislar los flujos de login y cambio de empresa.
 * @module src/features/auth/__tests__/auth-service-tenant.test
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock del cliente Prisma ────────────────────────────────────────────────

const { scopedMock, platformMock } = vi.hoisted(() => {
	const scopedMock = {
		user: {
			findUnique: vi.fn(),
			updateMany: vi.fn(),
		},
		tenantMembership: {
			findUnique: vi.fn(),
		},
		userSession: {
			deleteMany: vi.fn(),
			create: vi.fn(),
		},
	};
	const platformMock = {
		tenantMembership: {
			findUnique: vi.fn(),
		},
	};
	return { scopedMock, platformMock };
});

vi.mock('@/lib/prisma', () => ({ prisma: scopedMock }));
vi.mock('@/lib/db/platform-prisma', () => ({ prismaPlatform: platformMock }));

vi.mock('@/lib/auth-middleware', () => ({
	resolveTenantContext: vi.fn(),
}));

vi.mock('@/lib/secrets', () => ({
	getJwtSecret: vi.fn(() => 'test-secret'),
	getRefreshJwtSecret: vi.fn(() => 'test-refresh-secret'),
}));

vi.mock('@/lib/auth/onboarding', () => ({
	signOnboardingToken: vi.fn(() => 'onboarding-token-mock'),
}));

vi.mock('bcryptjs', () => ({
	default: { compare: vi.fn(), hash: vi.fn() },
	compare: vi.fn(),
	hash: vi.fn(),
}));

import bcrypt from 'bcryptjs';
import { resolveTenantContext } from '@/lib/auth-middleware';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { AuthService } from '../services/auth-service';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * @description Usuario persistido estándar para los escenarios de login.
 * @param {Record<string, unknown>} [overrides] - Campos a sobreescribir.
 * @returns {Record<string, unknown>} Usuario mockeado.
 */
function buildStoredUser(overrides: Record<string, unknown> = {}) {
	return {
		userId: 'user-1',
		name: 'Ana Prueba',
		email: 'ana@example.com',
		password: 'hashed-password',
		role: 'regularUser',
		isActive: true,
		expiresAt: null,
		lockedUntil: null,
		loginAttempts: 0,
		onboardingStatus: null,
		...overrides,
	};
}

/**
 * @description Usuario autenticado (contexto de request) para switchTenant.
 * @param {Record<string, unknown>} [overrides] - Campos a sobreescribir.
 * @returns {AuthenticatedUser} Usuario autenticado mockeado.
 */
function buildAuthUser(overrides: Record<string, unknown> = {}): AuthenticatedUser {
	return {
		userId: 'user-1',
		email: 'ana@example.com',
		role: 'regularUser',
		isActive: true,
		tenantId: 'tenant-a',
		tenantRole: 'dependiente',
		planFeatures: [],
		planName: 'Básico',
		permissions: [],
		...overrides,
	} as AuthenticatedUser;
}

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

// ─── PE-01: copy neutro ─────────────────────────────────────────────────────

describe('AuthService — copy neutro (PE-01)', () => {
	it('login sin empresa activa responde "No tienes" (sin voseo)', async () => {
		scopedMock.user.findUnique.mockResolvedValue(buildStoredUser());
		vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
		scopedMock.user.updateMany.mockResolvedValue({ count: 1 });
		vi.mocked(resolveTenantContext).mockResolvedValue(null);

		await expect(
			AuthService.login({
				input: { email: 'ana@example.com', password: 'secret123' },
			}),
		).rejects.toThrow('No tienes una empresa activa para iniciar sesión.');
	});

	it('switchTenant sin membresía responde "No tienes acceso" (sin voseo)', async () => {
		platformMock.tenantMembership.findUnique.mockResolvedValue(null);

		await expect(
			AuthService.switchTenant({
				tenantId: 'tenant-b',
				user: buildAuthUser(),
			}),
		).rejects.toThrow('No tienes acceso a esta empresa');
	});
});

// ─── PE-03: switchTenant fuera del contexto tenant ─────────────────────────

describe('AuthService.switchTenant — membresía platform (PE-03)', () => {
	it('cambia de tenant A a tenant B consultando membresía en platform bajo enforce', async () => {
		vi.stubEnv('TENANT_ISOLATION_MODE', 'enforce');
		platformMock.tenantMembership.findUnique.mockResolvedValue({
			tenantId: 'tenant-b',
			userId: 'user-1',
			isActive: true,
			tenantRole: 'manager',
		});
		vi.mocked(resolveTenantContext).mockResolvedValue({
			tenantId: 'tenant-b',
			tenantRole: 'manager',
		} as never);

		const result = await AuthService.switchTenant({
			tenantId: 'tenant-b',
			user: buildAuthUser({ tenantId: 'tenant-a', tenantRole: 'dependiente' }),
		});

		expect(result.tenantId).toBe('tenant-b');
		expect(result.tenantRole).toBe('manager');
		expect(platformMock.tenantMembership.findUnique).toHaveBeenCalledWith({
			where: { tenantId_userId: { tenantId: 'tenant-b', userId: 'user-1' } },
		});
		expect(scopedMock.tenantMembership.findUnique).not.toHaveBeenCalled();
	});

	it('rechaza FORBIDDEN cuando platform no encuentra la membresía destino', async () => {
		vi.stubEnv('TENANT_ISOLATION_MODE', 'enforce');
		platformMock.tenantMembership.findUnique.mockResolvedValue(null);

		await expect(
			AuthService.switchTenant({
				tenantId: 'tenant-b',
				user: buildAuthUser({ tenantId: 'tenant-a' }),
			}),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
		expect(platformMock.tenantMembership.findUnique).toHaveBeenCalled();
		expect(scopedMock.tenantMembership.findUnique).not.toHaveBeenCalled();
	});
});
