/**
 * @description Tests de prevención de doble conteo contable al facturar ofertas mixtas.
 * El cuadre actual suma Venta.total + VentaServicios.total, contando los servicios
 * dos veces cuando provienen de la misma oferta.
 * La solución es vincular VentaServicios con la Venta que lo generó (ventaId),
 * y excluir de los agregados de ingreso las VS que pertenecen a una venta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  venta: { findMany: vi.fn(), count: vi.fn() },
  ventaServicios: { findMany: vi.fn(), count: vi.fn() },
  reconciliacionGasto: { findMany: vi.fn() },
  compraServicio: { findMany: vi.fn(), count: vi.fn() },
  gastosDE: { findMany: vi.fn(), count: vi.fn() },
  gastoCompra: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { obtenerVentasVsReconciliado } from '@/features/contabilidad/cuadre-queries';

const rango = { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') };

describe('obtenerVentasVsReconciliado – prevención de doble conteo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Oferta mixta facturada: total 300 (200 producto + 100 servicio)
    mockPrisma.venta.findMany.mockResolvedValue([
      { ventaId: 'venta-1', total: 300, cantidad: 3, createdAt: new Date('2026-01-15'), metodoPago: null, reconciliaciones: [] },
    ]);
    mockPrisma.venta.count.mockResolvedValue(1);
    // El mock debe simular el filtro Prisma: si ventaId: null en el where,
    // entonces la VS con ventaId='venta-1' queda excluida del resultado.
    mockPrisma.ventaServicios.findMany.mockImplementation(
      (args: { where: { ventaId?: null } }) => {
        if (args?.where?.ventaId === null) {
          return Promise.resolve([]); // VS vinculada a Venta: excluida
        }
        return Promise.resolve([
          {
            ventaServicioId: 'vs-1', tenantId: 'tenant-1', servicioId: 'srv-1',
            cantidad: 1, total: 100, moneda: 'CUP',
            createdAt: new Date('2026-01-15'), reconciliaciones: [],
            ventaId: 'venta-1',
          },
        ]);
      },
    );
    mockPrisma.ventaServicios.count.mockResolvedValue(0);
    mockPrisma.reconciliacionGasto.findMany.mockResolvedValue([]);
    mockPrisma.compraServicio.findMany.mockResolvedValue([]);
    mockPrisma.compraServicio.count.mockResolvedValue(0);
    mockPrisma.gastosDE.findMany.mockResolvedValue([]);
    mockPrisma.gastosDE.count.mockResolvedValue(0);
    mockPrisma.gastoCompra.findMany.mockResolvedValue([]);
    mockPrisma.gastoCompra.count.mockResolvedValue(0);
  });

  it('no duplica el ingreso de un servicio que ya está en Venta', async () => {
    // Filtra VS vinculadas a una Venta: deben excluirse de la suma de ingresos
    const result = await obtenerVentasVsReconciliado('tenant-1', rango, '', 1, 50);

    const ventasServiciosWhere = mockPrisma.ventaServicios.findMany.mock.calls[0]?.[0]?.where;
    // El filtro debe excluir VS con ventaId no null
    expect(ventasServiciosWhere).toEqual(
      expect.objectContaining({ ventaId: null }),
    );

    // Ingreso total: solo la Venta (300), sin duplicar el servicio (100)
    const totalIngresos = result.items
      .filter((i) => i.tipo === 'VENTA' || i.tipo === 'SERVICIO')
      .reduce((sum, item) => sum + item.monto, 0);
    expect(totalIngresos).toBe(300);
  });
});
