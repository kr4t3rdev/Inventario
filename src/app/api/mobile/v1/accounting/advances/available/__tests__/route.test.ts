import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    anticipo: { findMany: vi.fn() },
  },
  default: {
    anticipo: { findMany: vi.fn() },
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import prisma from '@/lib/prisma';
import { GET } from '../route';

const user = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', role: 'manager', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { contabilidad: true },
};

describe('mobile advances available route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/advances/available'));
    expect(response.status).toBe(401);
  });

  it('returns available advances scoped by tenant and context', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);
    vi.mocked(prisma.anticipo.findMany).mockResolvedValue([{ anticipoId: 'a1' }] as never);

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/advances/available?contexto=factura&clienteId=cli-1&moneda=CUP'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.anticipos).toHaveLength(1);
    expect(prisma.anticipo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-1', tipo: 'COBRO', clienteId: 'cli-1', moneda: 'CUP' }),
    }));
  });
});
