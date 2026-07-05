import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    venta: { count: vi.fn() },
    reconciliacionVenta: { count: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
    reconciliacionServicio: { count: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
    pagosalario: { count: vi.fn() },
    gastosDE: { count: vi.fn() },
    gastoCompra: { count: vi.fn() },
    reconciliacionGasto: { count: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
  },
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

describe('mobile accounting reconciliation stats route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the tenant-scoped reconciliation summary', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(prisma.venta.count).mockResolvedValue(2 as never);
    vi.mocked(prisma.reconciliacionVenta.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.reconciliacionServicio.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.pagosalario.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.gastosDE.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.gastoCompra.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.reconciliacionGasto.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([
      {
        reconciliacionId: 'rv-1',
        createdAt: new Date('2026-06-21T10:00:00Z'),
        monto: 50,
        venta: { ventaId: 'v-1' },
        cuentaBancaria: { nombreBanco: 'Banco 1' },
      },
    ] as never);
    vi.mocked(prisma.reconciliacionServicio.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reconciliacionGasto.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reconciliacionVenta.aggregate).mockResolvedValue({ _sum: { montoConvertido: 50 } } as never);
    vi.mocked(prisma.reconciliacionServicio.aggregate).mockResolvedValue({ _sum: { montoConvertido: 25 } } as never);
    vi.mocked(prisma.reconciliacionGasto.aggregate).mockResolvedValue({ _sum: { montoConvertido: 10 } } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/reconciliation/stats', {
      headers: { authorization: 'Bearer mobile-access' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.modules.ventas.pending).toBe(2);
    expect(data.stats.reconciledAmount).toBe(85);
    expect(data.recentActivity).toHaveLength(1);
    expect(prisma.venta.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', reconciliaciones: { none: {} } },
    });
    expect(prisma.gastosDE.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', reconciliaciones: { none: {} } },
    });
  });
});
