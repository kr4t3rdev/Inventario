'use server';
import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { updateFacturaSchema } from './schemas';
import type { UpdateFacturaInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const FACTURA_INCLUDE = {
  serie: { select: { serieId: true, prefijo: true, descripcion: true } },
  cliente: { select: { clienteId: true, nombre: true, direccion: true, telefono: true } },
  venta: { include: { puntoDeVenta: { select: { pvId: true, nombre: true } }, producto: { select: { id: true, nombre: true, precioVenta: true } } } },
  items: { include: { producto: { select: { id: true, nombre: true, precioVenta: true } } } },
} as const;

export const getFacturasAction = withAction(async (f: { search?: string; estado?: string; clienteId?: string; serieId?: string; fechaInicio?: string; fechaFin?: string; page?: number; limit?: number } = {}, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const { search, estado, clienteId, serieId, fechaInicio, fechaFin, page=1, limit=50 } = f;
  const where: any = { tenantId };
  if (estado) where.estado = estado;
  if (clienteId) where.clienteId = clienteId;
  if (serieId) where.serieId = serieId;
  if (fechaInicio || fechaFin) { where.createdAt = {}; if (fechaInicio) where.createdAt.gte = new Date(fechaInicio); if (fechaFin) where.createdAt.lte = new Date(fechaFin); }
  if (search) where.OR = [{ numeroFactura: { contains: search } }, { cliente: { nombre: { contains: search } } }, { venta: { producto: { nombre: { contains: search } } } }];
  const [data, total] = await Promise.all([
    prisma.factura.findMany({ where, include: FACTURA_INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page-1)*Math.min(limit,100), take: Math.min(limit,100) }),
    prisma.factura.count({ where }),
  ]);
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total/limit) } };
});

export const getFacturaByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const f = await prisma.factura.findFirst({ where: { idFactura: id, tenantId }, include: FACTURA_INCLUDE });
  if (!f) throw new ActionError('Factura no encontrada', 'NOT_FOUND');
  return f;
});

export const updateFacturaAction = withAction(async (input: UpdateFacturaInput, user: AuthenticatedUser) => {
  const p = updateFacturaSchema.parse(input);
  const { facturaId, ...data } = p;
  const tenantId = requireTenant(user);
  const ex = await prisma.factura.findFirst({ where: { facturaId, tenantId } });
  if (!ex) throw new ActionError('Factura no encontrada', 'NOT_FOUND');
  const upd: any = {};
  if (data.estado !== undefined) upd.estado = data.estado;
  if (data.tipoDocumento !== undefined) upd.tipoDocumento = data.tipoDocumento;
  if (data.fechaVencimiento !== undefined) upd.fechaVencimiento = data.fechaVencimiento ? new Date(data.fechaVencimiento) : null;
  if (data.observaciones !== undefined) upd.observaciones = data.observaciones;
  if (data.terminosPago !== undefined) upd.terminosPago = data.terminosPago;
  if (data.metodoPago !== undefined) upd.metodoPago = data.metodoPago;
  const factura = await prisma.factura.update({ where: { facturaId }, data: upd, include: FACTURA_INCLUDE });
  revalidatePath('/busy/facturas');
  return factura;
});

export const deleteFacturaAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const ex = await prisma.factura.findFirst({ where: { idFactura: id, tenantId } });
  if (!ex) throw new ActionError('Factura no encontrada', 'NOT_FOUND');
  await prisma.factura.delete({ where: { idFactura: id } });
  revalidatePath('/busy/facturas');
  return { id, eliminado: true };
});
