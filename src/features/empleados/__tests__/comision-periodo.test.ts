/**
 * @description Tests de imputación temporal de devoluciones en el reporte de
 * comisiones (tarea 6.1 del change remediacion-integridad-ventas-credito-fiscal):
 * una devolución se imputa al mes de su VENTA original, no al mes en que se
 * registró. La consulta de devoluciones se hace por los IDs de las ventas del
 * período (sin filtro por fecha de devolución) y sólo si hay ventas.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  venta: { findMany: vi.fn() },
  devolucionVenta: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { prisma } from '@/lib/prisma';
import { getComisionEmpleado } from '@/features/empleados/services/comision-service';

const AGOSTO = { desde: new Date('2026-08-01T00:00:00Z'), hasta: new Date('2026-08-31T23:59:59.999Z') };
const SEPTIEMBRE = { desde: new Date('2026-09-01T00:00:00Z'), hasta: new Date('2026-09-30T23:59:59.999Z') };

/** Venta elegible del empleado con ID explícito. */
function venta(ventaId: string, total: number, createdAt: Date) {
  return { ventaId, empleadoId: 'e-1', total, estado: 'FACTURADA', deletedAt: null, createdAt };
}

describe('getComisionEmpleado: devoluciones imputadas al mes de la venta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.devolucionVenta.findMany.mockResolvedValue([]);
  });

  it('la devolución de septiembre de una venta de agosto NO descuenta el reporte de septiembre', async () => {
    // Septiembre tiene su propia venta de 4000; la devolución de 1000 pertenece
    // a una venta de agosto y no debe entrar al período por fecha de registro.
    prismaMock.venta.findMany.mockResolvedValue([venta('v-sep', 4000, new Date('2026-09-10T12:00:00Z'))]);
    prismaMock.devolucionVenta.findMany.mockImplementation(async (args: { where?: { ventaId?: { in?: string[] } } }) => {
      const ids = args?.where?.ventaId?.in ?? [];
      return ids.includes('v-ago') ? [{ total: 1000 }] : [];
    });

    const reporte = await getComisionEmpleado({
      tenantId: 't-1', empleadoId: 'e-1', ...SEPTIEMBRE, comisionPct: 10,
    });

    expect(reporte.baseNeta).toBe(4000);
    expect(prismaMock.devolucionVenta.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ ventaId: { in: ['v-sep'] } }),
    }));
    // La consulta de devoluciones no filtra por fecha de registro.
    const where = prismaMock.devolucionVenta.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('createdAt');
  });

  it('consultando agosto, la devolución registrada en septiembre SÍ descuenta su venta de agosto', async () => {
    prismaMock.venta.findMany.mockResolvedValue([venta('v-ago', 5000, new Date('2026-08-05T12:00:00Z'))]);
    prismaMock.devolucionVenta.findMany.mockResolvedValue([{ total: 1000 }]);

    const reporte = await getComisionEmpleado({
      tenantId: 't-1', empleadoId: 'e-1', ...AGOSTO, comisionPct: 10,
    });

    expect(reporte.baseBruta).toBe(5000);
    expect(reporte.devolucionesElegibles).toBe(1000);
    expect(reporte.baseNeta).toBe(4000);
    expect(prismaMock.devolucionVenta.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ ventaId: { in: ['v-ago'] } }),
    }));
  });

  it('sin ventas en el período no consulta devoluciones', async () => {
    prismaMock.venta.findMany.mockResolvedValue([]);

    const reporte = await getComisionEmpleado({
      tenantId: 't-1', empleadoId: 'e-1', ...SEPTIEMBRE, comisionPct: 10,
    });

    expect(reporte.baseBruta).toBe(0);
    expect(prismaMock.devolucionVenta.findMany).not.toHaveBeenCalled();
  });

  it('la reconsulta no genera escrituras (reporte derivado)', async () => {
    prismaMock.venta.findMany.mockResolvedValue([venta('v-sep', 4000, new Date('2026-09-10T12:00:00Z'))]);
    prismaMock.devolucionVenta.findMany.mockResolvedValue([]);

    await getComisionEmpleado({ tenantId: 't-1', empleadoId: 'e-1', ...SEPTIEMBRE, comisionPct: 10 });
    await getComisionEmpleado({ tenantId: 't-1', empleadoId: 'e-1', ...SEPTIEMBRE, comisionPct: 10 });

    expect(prismaMock.devolucionVenta.create).not.toHaveBeenCalled();
    expect(prismaMock.devolucionVenta.update).not.toHaveBeenCalled();
    expect(prismaMock.devolucionVenta.updateMany).not.toHaveBeenCalled();
    expect(prisma.devolucionVenta.findMany).toHaveBeenCalledTimes(2);
  });
});
