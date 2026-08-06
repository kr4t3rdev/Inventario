import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '../route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    userSession: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    tenantMembership: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    tenantLicense: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('@/lib/secrets', () => ({
  getJwtSecret: vi.fn(() => 'test-secret'),
  getRefreshJwtSecret: vi.fn(() => 'test-refresh-secret'),
}));

const cookieMap: Record<string, string> = {};
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: (name: string) => {
      const value = cookieMap[name];
      return value ? { name, value } : undefined;
    },
    set: (name: string, value: string) => {
      cookieMap[name] = typeof value === 'object' && value && 'value' in value
        ? (value as { value: string }).value
        : (value as string);
    },
    delete: (name: string) => {
      delete cookieMap[name];
    },
  })),
}));

describe('auth refresh route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(cookieMap)) delete cookieMap[k];
    cookieMap.refreshToken = 'valid';
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.tenantLicense.findFirst).mockResolvedValue(null as never);
  });

  it('rechaza usuario inactivo', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { prisma } = await import('@/lib/prisma');

    vi.mocked(jwt.verify).mockReturnValue({ userId: 'u1', email: 'u@test.com' } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      userId: 'u1',
      isActive: false,
      expiresAt: null,
    } as never);

    const request = new NextRequest('http://localhost/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: 'refreshToken=valid' },
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('desactiva y rechaza usuario expirado', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { prisma } = await import('@/lib/prisma');

    vi.mocked(jwt.verify).mockReturnValue({ userId: 'u2', email: 'u2@test.com' } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      userId: 'u2',
      isActive: true,
      expiresAt: new Date(Date.now() - 60_000),
    } as never);

    const request = new NextRequest('http://localhost/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: 'refreshToken=valid' },
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u2' },
      data: { isActive: false },
    });
  });

  it('rechaza cuando no hay sesión activa', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { prisma } = await import('@/lib/prisma');

    vi.mocked(jwt.verify).mockReturnValue({ userId: 'u3', email: 'u3@test.com' } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      userId: 'u3',
      isActive: true,
      expiresAt: null,
    } as never);
    vi.mocked(prisma.userSession.findFirst).mockResolvedValue(null as never);

    const request = new NextRequest('http://localhost/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: 'refreshToken=valid' },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('emite token y crea sesión cuando el usuario es válido', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { prisma } = await import('@/lib/prisma');

    vi.mocked(jwt.verify).mockReturnValue({ userId: 'u4', email: 'u4@test.com', tenantId: 'tenant-1' } as never);
    vi.mocked(jwt.sign)
      .mockReturnValueOnce('new-access-token' as never)
      .mockReturnValueOnce('new-refresh-token' as never);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      userId: 'u4',
      isActive: true,
      expiresAt: null,
    } as never);
    vi.mocked(prisma.userSession.findFirst).mockResolvedValue({ id: 's1' } as never);
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
      membershipId: 'm1',
      tenantId: 'tenant-1',
      userId: 'u4',
      tenantRole: 'manager',
      isActive: true,
    } as never);
    vi.mocked(prisma.tenantLicense.findFirst).mockResolvedValue({
      expiracion: new Date(Date.now() + 1000000),
      maxUsuarios: 10,
      maxAlmacenes: 5,
      maxProductos: 500,
    } as never);
    vi.mocked(prisma.userSession.deleteMany).mockResolvedValue({ count: 1 } as never);

    const request = new NextRequest('http://localhost/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: 'refreshToken=valid', 'user-agent': 'vitest' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.token).toBe('new-access-token');
    expect(vi.mocked(jwt.sign)).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ tenantId: 'tenant-1', tenantRole: 'manager' }),
      expect.any(String),
      expect.objectContaining({ expiresIn: '15m' })
    );
    expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u4' } });
    expect(prisma.userSession.create).toHaveBeenCalled();
  });
});
