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

describe('web accounting reconciliation stats route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filtra métricas por tenantId', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { userId: 'u1', tenantId: 'tenant-web-1' },
    } as never);
    vi.mocked(prisma.venta.count).mockResolvedValue(2 as never);
    vi.mocked(prisma.reconciliacionVenta.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.reconciliacionServicio.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.pagosalario.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.gastosDE.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.gastoCompra.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.reconciliacionGasto.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reconciliacionServicio.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reconciliacionGasto.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.reconciliacionVenta.aggregate).mockResolvedValue({ _sum: { montoConvertido: 0 } } as never);
    vi.mocked(prisma.reconciliacionServicio.aggregate).mockResolvedValue({ _sum: { montoConvertido: 0 } } as never);
    vi.mocked(prisma.reconciliacionGasto.aggregate).mockResolvedValue({ _sum: { montoConvertido: 0 } } as never);

    const response = await GET(new NextRequest('http://localhost/api/contabilidad/reconciliacion/stats'));

    expect(response.status).toBe(200);
    expect(prisma.venta.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-web-1', reconciliaciones: { none: {} } },
    });
    expect(prisma.reconciliacionGasto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-web-1' } }),
    );
    expect(prisma.reconciliacionVenta.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-web-1' }),
      }),
    );
  });
});
