import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    merma: { aggregate: vi.fn() },
    venta: { aggregate: vi.fn() },
    gastoCompra: { aggregate: vi.fn() },
    producto: { aggregate: vi.fn() },
  },
}));
vi.mock('@/features/contabilidad/services/reconciled-result-service', () => ({
  getReconciledResultForYear: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { getReconciledResultForYear } from '@/features/contabilidad/services/reconciled-result-service';
import { calcularEstadisticasCierre } from '../cierreContableService';

describe('calcularEstadisticasCierre', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.merma.aggregate).mockResolvedValue({ _sum: { costoTotal: 0, cantidad: 0 } } as never);
    vi.mocked(prisma.venta.aggregate).mockResolvedValue({ _sum: { total: 0, cantidad: 0 } } as never);
    vi.mocked(prisma.gastoCompra.aggregate).mockResolvedValue({ _sum: { total: 0 } } as never);
    vi.mocked(prisma.producto.aggregate).mockResolvedValue({ _sum: { stock: 0 } } as never);
    vi.mocked(getReconciledResultForYear).mockResolvedValue({
      annual: {
        income: { total: 100 },
        costOfSales: { total: 20 },
        operatingExpenses: { total: 30 },
        inventoryPurchases: 10,
        reconciledResult: 50,
      },
    } as never);
  });

  it('uses the canonical result for the requested period', async () => {
    const fechaInicio = new Date('2026-01-01T00:00:00.000Z');
    const fechaFin = new Date('2026-01-31T00:00:00.000Z');

    const result = await calcularEstadisticasCierre('tenant-a', fechaInicio, fechaFin);

    expect(getReconciledResultForYear).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      year: 2026,
      startAt: fechaInicio,
      cutoffAt: expect.any(Date),
    });
    expect(result.ingresosCaja).toBe(100);
    expect(result.ganancias).toBe(50);
  });

  it('excluye el COGS del egreso de caja e incluye las compras de inventario', async () => {
    const fechaInicio = new Date('2026-01-01T00:00:00.000Z');
    const fechaFin = new Date('2026-01-31T00:00:00.000Z');

    const result = await calcularEstadisticasCierre('tenant-a', fechaInicio, fechaFin);

    expect(result.egresosCaja).toBe(40);
    expect(result.totalGastos).toBe(50);
  });
});
