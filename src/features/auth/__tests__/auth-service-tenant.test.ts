/**
 * @description Tests de AuthService para copy neutro (PE-01), con Prisma
 * mockeado para aislar los flujos de login y cambio de empresa.
 * @module src/features/auth/__tests__/auth-service-tenant.test
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock del cliente Prisma ────────────────────────────────────────────────

const { scopedMock } = vi.hoisted(() => {
	const scopedMock = {
		user: {
			findUnique: vi.fn(),
			updateMany: vi.fn(),
		},
		tenantMembership: {
			findUnique: vi.fn(),
		},
	};
	return { scopedMock };
});

vi.mock('@/lib/prisma', () => ({ prisma: scopedMock }));

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
		scopedMock.tenantMembership.findUnique.mockResolvedValue(null);

		await expect(
			AuthService.switchTenant({
				tenantId: 'tenant-b',
				user: buildAuthUser(),
			}),
		).rejects.toThrow('No tienes acceso a esta empresa');
	});
});
