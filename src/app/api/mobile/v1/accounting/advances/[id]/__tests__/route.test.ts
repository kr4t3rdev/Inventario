import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    anticipo: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
  default: {
    anticipo: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import prisma from '@/lib/prisma';
import { GET, PUT, DELETE } from '../route';

const user = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', role: 'manager', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { contabilidad: true },
};

describe('mobile advance by id route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/advances/a1'), { params: Promise.resolve({ id: 'a1' }) } as never);
    expect(response.status).toBe(401);
  });

  it('returns anticipo detail scoped by tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);
    vi.mocked(prisma.anticipo.findUnique).mockResolvedValue({ anticipoId: 'a1' } as never);

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/advances/a1'), { params: Promise.resolve({ id: 'a1' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.anticipo.anticipoId).toBe('a1');
    expect(prisma.anticipo.findUnique).toHaveBeenCalled();
  });

  it('updates anticipo', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);
    vi.mocked(prisma.anticipo.findUnique).mockResolvedValue({ anticipoId: 'a1' } as never);
    vi.mocked(prisma.anticipo.update).mockResolvedValue({ anticipoId: 'a1' } as never);

    const response = await PUT(new NextRequest('http://localhost/api/mobile/v1/accounting/advances/a1', {
      method: 'PUT',
      body: JSON.stringify({ estado: 'EJECUTADO' }),
      headers: { 'content-type': 'application/json' },
    }), { params: Promise.resolve({ id: 'a1' }) } as never);

    expect(response.status).toBe(200);
    expect(prisma.anticipo.update).toHaveBeenCalled();
  });

  it('deletes anticipo', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);
    vi.mocked(prisma.anticipo.findUnique).mockResolvedValue({ anticipoId: 'a1' } as never);
    vi.mocked(prisma.anticipo.delete).mockResolvedValue({} as never);

    const response = await DELETE(new NextRequest('http://localhost/api/mobile/v1/accounting/advances/a1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'a1' }) } as never);

    expect(response.status).toBe(200);
    expect(prisma.anticipo.delete).toHaveBeenCalled();
  });
});
