'use server';
import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { getStockTotalProductosBatch } from '@/lib/services/stock-ubicacion-queries';
import { calcularValuacionFifo } from './lib/valoracion-fifo';
import { reporteSchema } from './schemas';
import type { ReporteInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getReporteFinancieroAction = withAction(async (input: ReporteInput, user: AuthenticatedUser) => {
  requireFeature(user, 'reportes-financieros', 'consultar reportes financieros');
  const tenantId = requireTenant(user);
  const parsed = reporteSchema.parse(input);
  const [year, month] = parsed.periodo.split('-');
  const startDate = new Date(Number(year), Number(month) - 1, 1);
  const endDate = new Date(Number(year), Number(month), 0);

  const [ventas, compras, salarios, mermas] = await Promise.all([
    prisma.venta.findMany({ where: { tenantId, createdAt: { gte: startDate, lte: endDate } }, select: { cantidad: true, producto: { select: { id: true, nombre: true, precioVenta: true, precioCosto: true } } } }),
    prisma.gastoCompra.findMany({ where: { tenantId, createdAt: { gte: startDate, lte: endDate } }, select: { total: true } }),
    prisma.empleado.findMany({ where: { tenantId, createdAt: { gte: startDate, lte: endDate } }, select: { empleadoId: true, nombre: true, apellido: true, salarioBases: true } }),
    prisma.merma.findMany({ where: { tenantId, createdAt: { gte: startDate, lte: endDate } }, select: { cantidad: true, costoTotal: true } }),
  ]);

  // @ts-expect-error La relación producto de Venta no está tipada en el findMany con select anidado
  const totalVentas = ventas.reduce((s, v) => s + v.cantidad * v.producto.precioVenta, 0);
  const totalCompras = compras.reduce((s, c) => s + c.total, 0);
  const totalSalarios = salarios.reduce((s, e) => s + e.salarioBases, 0);
  const totalMermas = mermas.reduce((s, m) => s + (m.costoTotal || 0), 0);

  return { periodo: parsed.periodo, resumen: { totalVentas, totalCompras, totalSalarios, totalMermas, resultado: totalVentas - totalCompras - totalSalarios - totalMermas }, detalles: { ventas: ventas.length, compras: compras.length, salarios: salarios.length, mermas: mermas.length } };
});

/**
 * @description Valoración FIFO del inventario actual por producto y total.
 * Combina lotes de compra netos de allocations (devoluciones ya restauradas) con
 * el stock físico de StockUbicacion; la parte sin lote se estima a precioCosto y
 * se marca. Sin gate de feature: es una lectura del mismo alcance que el listado
 * de productos que la página de reportes ya consume.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado (tenant obligatorio).
 * @returns {Promise<ValuacionInventario>} Valoración por producto y totales.
 */
export const getValorInventarioFifoAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);

  const [lotes, allocPorLote, productos] = await Promise.all([
    prisma.compraDocumentoItem.findMany({
      where: { tenantId, compraDocumento: { deletedAt: null, estado: { not: 'ANULADA' } } },
      select: { compraDocumentoItemId: true, productoId: true, cantidad: true, precioUnitario: true },
    }),
    prisma.purchaseAllocation.groupBy({
      by: ['compraDocumentoItemId'],
      where: { compraDocumentoItem: { compraDocumento: { tenantId, deletedAt: null } } },
      _sum: { cantidad: true },
    }),
    prisma.producto.findMany({
      where: { tenantId },
      select: { id: true, precioCosto: true },
    }),
  ]);

  const stockPorProducto = await getStockTotalProductosBatch(prisma, {
    productoIds: productos.map((p) => p.id),
  });

  return calcularValuacionFifo(
    lotes.map((l) => ({
      id: l.compraDocumentoItemId,
      productoId: l.productoId,
      cantidad: l.cantidad,
      precioUnitario: l.precioUnitario,
    })),
    new Map(allocPorLote.map((a) => [a.compraDocumentoItemId, a._sum.cantidad ?? 0])),
    productos.map((p) => ({
      productoId: p.id,
      precioCosto: Number(p.precioCosto),
      stockTotal: stockPorProducto.get(p.id) ?? 0,
    })),
  );
});
