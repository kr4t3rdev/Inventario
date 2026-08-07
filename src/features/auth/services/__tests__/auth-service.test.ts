/**
 * @description Tests TDD para AuthService mobile-ready.
 *
 * El servicio NO debe depender de cookies()/headers(); las acciones web
 * serán adaptadores que escriben cookies por fuera del servicio.
 *
 * @module features/auth/services/__tests__/auth-service.test
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    userSession: {
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    userActivityLog: {
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    tenantMembership: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    tenantLicense: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn() },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock('@/lib/secrets', () => ({
  getJwtSecret: vi.fn(() => 'test-secret'),
  getRefreshJwtSecret: vi.fn(() => 'test-refresh-secret'),
}));

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import { AuthService } from '../auth-service';

function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    password: '$2a$12$hashedpassword',
    role: 'regularUser',
    isActive: true,
    expiresAt: null,
    lockedUntil: null,
    loginAttempts: 0,
    onboardingStatus: null,
    ...overrides,
  };
}

describe('AuthService.login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks no vacía la cola de mockReturnValueOnce; sin el reset,
    // valores sin consumir de tests previos se filtran al siguiente test.
    vi.mocked(jwt.sign).mockReset();
    vi.mocked(jwt.sign)
      .mockReturnValueOnce('access-token' as never)
      .mockReturnValueOnce('refresh-token' as never);
  });

  it('returns token payload for valid credentials without touching cookies', async () => {
    const user = createMockUser();
    const licenseExpiresAt = new Date(Date.now() + 86_400_000);

    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({
      tenantId: 'tenant-1',
      tenantRole: 'manager',
      isActive: true,
    } as never);
    vi.mocked(prisma.tenantLicense.findFirst).mockResolvedValue({
      maxUsuarios: 10,
      maxAlmacenes: 5,
      maxProductos: 500,
      expiracion: licenseExpiresAt,
      features: { productos: true },
    } as never);
    vi.mocked(prisma.userSession.create).mockResolvedValue({ id: 'session-1' } as never);
    vi.mocked(prisma.userActivityLog.create).mockResolvedValue({} as never);

    const result = await AuthService.login({
      input: { email: 'test@example.com', password: 'secret123' },
      client: { ipAddress: '127.0.0.1', userAgent: 'vitest' },
    });

    expect(result.tokens.accessToken).toBe('access-token');
    expect(result.tokens.refreshToken).toBe('refresh-token');
    expect(result.user.password).toBeUndefined();
    expect(result.user.tenantId).toBe('tenant-1');
    expect(result.user.tenantRole).toBe('manager');
    expect(result.user.planFeatures).toEqual({ productos: true });
    expect(prisma.userSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        token: 'access-token',
        isActive: true,
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
      }),
    });
  });

  it('throws INVALID_CREDENTIALS and increments attempts when password is wrong', async () => {
    const user = createMockUser({ loginAttempts: 1 });

    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as never);

    await expect(
      AuthService.login({
        input: { email: 'test@example.com', password: 'wrong' },
        client: {},
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' } satisfies Partial<ActionError>);

    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        data: expect.objectContaining({ loginAttempts: 2 }),
      }),
    );
    expect(prisma.userSession.create).not.toHaveBeenCalled();
  });

  it('throws NO_TENANT for regular users without active tenant context', async () => {
    const user = createMockUser({ role: 'regularUser' });

    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(null as never);

    await expect(
      AuthService.login({
        input: { email: 'test@example.com', password: 'secret123' },
        client: {},
      }),
    ).rejects.toMatchObject({ code: 'NO_TENANT' } satisfies Partial<ActionError>);

    expect(prisma.userSession.create).not.toHaveBeenCalled();
  });

  it('allows an active salesAgent without tenant and returns its safe redirect', async () => {
    const user = createMockUser({ role: 'salesAgent', isActive: true });

    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.userSession.create).mockResolvedValue({ id: 'session-agent' } as never);
    vi.mocked(prisma.userActivityLog.create).mockResolvedValue({} as never);

    const result = await AuthService.login({
      input: { email: 'test@example.com', password: 'secret123' },
      client: {},
    });

    expect(result.user.role).toBe('salesAgent');
    expect(result.user.tenantId).toBeUndefined();
    expect(result.redirectTo).toBe('/sales-agent/referidos');
  });

  it('does not resolve or expose tenant context for an active salesAgent', async () => {
    const user = createMockUser({ role: 'salesAgent', isActive: true });

    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({
      tenantId: 'tenant-stale',
      tenantRole: 'manager',
      isActive: true,
    } as never);
    vi.mocked(prisma.userSession.create).mockResolvedValue({ id: 'session-agent' } as never);
    vi.mocked(prisma.userActivityLog.create).mockResolvedValue({} as never);

    const result = await AuthService.login({
      input: { email: 'test@example.com', password: 'secret123' },
      client: {},
    });

    expect(result.user).not.toHaveProperty('tenantId');
    expect(prisma.tenantMembership.findFirst).not.toHaveBeenCalled();
  });

  it('keeps a pending salesAgent in onboarding instead of returning an app redirect', async () => {
    const user = createMockUser({
      role: 'regularUser',
      isActive: false,
      onboardingStatus: 'awaiting_sales_agent_approval',
    });

    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.userSession.create).mockResolvedValue({ id: 'session-pending' } as never);
    vi.mocked(prisma.userActivityLog.create).mockResolvedValue({} as never);
    vi.mocked(jwt.sign).mockReturnValueOnce('onboarding-token' as never);

    const result = await AuthService.login({
      input: { email: 'test@example.com', password: 'secret123' },
      client: {},
    });

    expect(result.redirectTo).toBe('/onboarding');
    expect(result.onboardingToken).toBe('onboarding-token');
  });

  it('sends an admin with a stale mid-onboarding status to /admin, not onboarding', async () => {
    const user = createMockUser({
      role: 'admin',
      isActive: true,
      onboardingStatus: 'pending_email_verification',
    });

    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.userSession.create).mockResolvedValue({ id: 'session-admin' } as never);
    vi.mocked(prisma.userActivityLog.create).mockResolvedValue({} as never);

    const result = await AuthService.login({
      input: { email: 'test@example.com', password: 'secret123' },
      client: {},
    });

    expect(result.redirectTo).toBe('/admin');
    expect(result.onboardingToken).toBeUndefined();
    expect(prisma.tenantMembership.findFirst).toHaveBeenCalled();
  });

  it('does not expose an onboarding token for users with an active tenant', async () => {
    const user = createMockUser({ role: 'admin' });
    const licenseExpiresAt = new Date(Date.now() + 86_400_000);

    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({
      tenantId: 'tenant-1',
      tenantRole: 'admin',
      isActive: true,
    } as never);
    vi.mocked(prisma.tenantLicense.findFirst).mockResolvedValue({
      maxUsuarios: 10,
      maxAlmacenes: 5,
      maxProductos: 500,
      expiracion: licenseExpiresAt,
      features: { productos: true },
    } as never);
    vi.mocked(prisma.userSession.create).mockResolvedValue({ id: 'session-admin' } as never);
    vi.mocked(prisma.userActivityLog.create).mockResolvedValue({} as never);

    const result = await AuthService.login({
      input: { email: 'test@example.com', password: 'secret123' },
      client: {},
    });

    expect(result.redirectTo).toBe('/admin');
    expect(result.onboardingToken).toBeUndefined();
  });

  it('unbounces a worker already approved: active membership self-heals stale onboarding status', async () => {
    const user = createMockUser({
      role: 'regularUser',
      isActive: true,
      onboardingStatus: 'awaiting_manager_approval',
    });
    const licenseExpiresAt = new Date(Date.now() + 86_400_000);

    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({
      membershipId: 'mem-1',
      tenantId: 'tenant-1',
      tenantRole: 'dependiente',
      isActive: true,
    } as never);
    vi.mocked(prisma.tenantLicense.findFirst).mockResolvedValue({
      maxUsuarios: 10,
      maxAlmacenes: 5,
      maxProductos: 500,
      expiracion: licenseExpiresAt,
      features: { productos: true },
    } as never);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.userSession.create).mockResolvedValue({ id: 'session-worker' } as never);
    vi.mocked(prisma.userActivityLog.create).mockResolvedValue({} as never);

    const result = await AuthService.login({
      input: { email: 'test@example.com', password: 'secret123' },
      client: {},
    });

    expect(result.redirectTo).toBe('/busy/dashboard');
    expect(result.onboardingToken).toBeUndefined();
    expect(result.user.onboardingStatus).toBeNull();
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', onboardingStatus: { not: null } },
        data: { onboardingStatus: null },
      }),
    );
  });
});
