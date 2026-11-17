import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  moneda: {
    findMany: vi.fn(),
  },
  tasaCambio: {
    findMany: vi.fn(),
  },
  tenantAccountingPolicy: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  default: prismaMock,
  prisma: prismaMock,
}));

import prisma from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import { GET } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { contabilidad: true },
};

describe('mobile exchange tasas route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(prisma.moneda.findMany).mockResolvedValue([
      { codigo: 'CUP', nombre: 'Peso cubano', esPrincipal: true },
      { codigo: 'USD', nombre: 'Dólar', esPrincipal: false },
    ] as never);
    vi.mocked(prisma.tasaCambio.findMany).mockResolvedValue([
      {
        tasaId: 't1',
        monedaOrigenId: 'USD',
        monedaDestino: 'CUP',
        tasa: '24',
        fechaVigencia: new Date('2026-06-22T00:00:00.000Z'),
      },
    ] as never);
  });

  it('returns the principal currency from the tenant accounting policy', async () => {
    vi.mocked(prisma.tenantAccountingPolicy.findUnique).mockResolvedValue({
      tenantId: 'tenant-1',
      functionalCurrencyCode: 'USD',
    } as never);

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/exchange/tasas', {
      headers: { authorization: 'Bearer mobile-access' },
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.tenantAccountingPolicy.findUnique).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      select: { functionalCurrencyCode: true },
    });
    expect(data.data.monedaPrincipal.codigo).toBe('USD');
    expect(data.data.tasas).toHaveLength(1);
    expect(prisma.tasaCambio.findMany).toHaveBeenCalledWith({
      orderBy: { fechaVigencia: 'desc' },
      take: 50,
    });
  });

  it('does not fall back to the first catalog currency when the policy is absent', async () => {
    vi.mocked(prisma.tenantAccountingPolicy.findUnique).mockResolvedValue(null as never);

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/exchange/tasas', {
      headers: { authorization: 'Bearer mobile-access' },
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.monedaPrincipal).toBeNull();
  });
});
