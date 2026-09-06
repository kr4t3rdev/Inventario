import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => Object.fromEntries([
  'producto', 'almacen', 'puntoDeVenta', 'venta', 'ventaItem', 'ventaServicios',
  'merma', 'gastosDE', 'pagosalario', 'transferencia', 'gastoCompra',
  'stockUbicacion', 'compraServicio',
].map((model) => [model, { count: vi.fn(), findMany: vi.fn() }])));

vi.mock('@/lib/prisma', () => ({ prisma }));

import { getDashboardStatsData, invalidateDashboardStatsCache } from '../dashboard-stats-service';

const createdAt = new Date('2026-09-03T12:00:00Z');

describe('operational dashboard expenses', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-06T12:00:00Z'));
    invalidateDashboardStatsCache();
    for (const model of Object.values(prisma)) {
      model.count.mockReset().mockResolvedValue(0);
      model.findMany.mockReset().mockResolvedValue([]);
    }
    prisma.ventaServicios.findMany.mockResolvedValue([{ total: 9600, cantidad: 1, createdAt }]);
    prisma.gastosDE.findMany.mockResolvedValue([{ monto: 130500, periodo: '2026-08', createdAt }]);
    prisma.pagosalario.findMany.mockResolvedValue([{
      salario: 225000, bonificaciones: 18500, deducciones: 6500, horasExtras: 0,
      periodo: '2026-08', createdAt,
    }]);
    prisma.compraServicio.findMany.mockResolvedValue([{
      total: 59000, fechaServicio: new Date('2026-08-15T12:00:00Z'), createdAt,
    }]);
  });

  afterEach(() => vi.useRealTimers());

  it('subtracts purchased services once, but not inventory purchases, from benefit', async () => {
    prisma.gastoCompra.findMany.mockResolvedValue([{ total: 100000, createdAt }]);
    const stats = await getDashboardStatsData({ tenantId: 'tenant-expenses' });
    expect(stats.totalBeneficio).toBe(-416900);
    expect(prisma.compraServicio.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-expenses' }, select: { total: true, createdAt: true },
    });
  });

  it('keeps operational source dates for all expenses in monthly and weekly charts', async () => {
    const stats = await getDashboardStatsData({ tenantId: 'tenant-dates' });
    expect(stats.datosPorMes.at(-1)).toMatchObject({
      gastosDeExplotacion: 189500, gastosDeExplotacionCantidad: 2, gastosSalarios: 237000,
    });
    expect(stats.datosPorMes.at(-2)).toMatchObject({
      gastosDeExplotacion: 0, gastosSalarios: 0,
    });
    expect(stats.datosPorSemana).toHaveLength(1);
    expect(stats.datosPorSemana[0]).toMatchObject({
      semana: '2026-W36', gastosDeExplotacion: 189500, gastosSalarios: 237000,
    });
  });

  it('preserves the result when no purchased services exist', async () => {
    prisma.compraServicio.findMany.mockResolvedValue([]);
    const stats = await getDashboardStatsData({ tenantId: 'tenant-empty-services' });
    expect(stats.totalBeneficio).toBe(-357900);
  });
});
