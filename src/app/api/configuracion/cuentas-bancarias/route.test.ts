import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  default: {
    cuentaBancaria: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: vi.fn((handler) => (request: NextRequest) =>
    handler(request, {}, {
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      isActive: true,
      tenantId: 'tenant-1',
    }),
  ),
}));

import prisma from '@/lib/prisma';
import { GET } from './route';

describe('/api/configuracion/cuentas-bancarias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tenant-scoped cuentas using the canonical payload shape', async () => {
    vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([
      {
        cuentaId: 'c1',
        nombreBanco: 'Banco 1',
        numeroCuenta: '123',
        tipoCuenta: 'corriente',
        saldo: 120,
        moneda: 'CUP',
        isActive: true,
      },
    ] as never);

    const response = await GET(new NextRequest('http://localhost/api/configuracion/cuentas-bancarias'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cuentas).toHaveLength(1);
    expect(data.cuentas[0]).toMatchObject({ cuentaId: 'c1', moneda: 'CUP', saldo: 120 });
    expect(prisma.cuentaBancaria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', isActive: true },
      }),
    );
  });

  it('returns 500 when fetching cuentas fails', async () => {
    vi.mocked(prisma.cuentaBancaria.findMany).mockRejectedValue(new Error('db down'));

    const response = await GET(new NextRequest('http://localhost/api/configuracion/cuentas-bancarias'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Error al obtener cuentas bancarias');
  });
});
