import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '../route';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userSession: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

describe('auth refresh route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(prisma.user.update).toHaveBeenCalledWith({
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

    vi.mocked(jwt.verify).mockReturnValue({ userId: 'u4', email: 'u4@test.com' } as never);
    vi.mocked(jwt.sign)
      .mockReturnValueOnce('new-access-token' as never)
      .mockReturnValueOnce('new-refresh-token' as never);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      userId: 'u4',
      isActive: true,
      expiresAt: null,
    } as never);
    vi.mocked(prisma.userSession.findFirst).mockResolvedValue({ id: 's1' } as never);

    const request = new NextRequest('http://localhost/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: 'refreshToken=valid', 'user-agent': 'vitest' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.token).toBe('new-access-token');
    expect(prisma.userSession.create).toHaveBeenCalled();
  });
});
