'use server';
import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
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
