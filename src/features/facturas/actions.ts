'use server';
import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { updateFacturaSchema } from './schemas';
import {
  FACTURA_INCLUDE,
  getFacturaForTenant,
  listFacturasForTenant,
} from './services/factura-read-service';
import type { UpdateFacturaInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getFacturasAction = withAction(async (f: { search?: string; estado?: string; clienteId?: string; serieId?: string; fechaInicio?: string; fechaFin?: string; page?: number; limit?: number } = {}, user: AuthenticatedUser) => {
  requireFeature(user, 'facturacion', 'gestionar facturación');
  const tenantId = requireTenant(user);
  return listFacturasForTenant(tenantId, f);
});

export const getFacturaByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'facturacion', 'gestionar facturación');
  const tenantId = requireTenant(user);
  const f = await getFacturaForTenant(id, tenantId);
  if (!f) throw new ActionError('Factura no encontrada', 'NOT_FOUND');
  return f as any;
});

export const updateFacturaAction = withAction(async (input: UpdateFacturaInput, user: AuthenticatedUser) => {
  requireFeature(user, 'facturacion', 'gestionar facturación');
  const p = updateFacturaSchema.parse(input);
  const { facturaId, ...data } = p;
  const tenantId = requireTenant(user);
  const ex = await prisma.factura.findFirst({
  where: { idFactura: facturaId, tenantId }
  });
  if (!ex) throw new ActionError('Factura no encontrada', 'NOT_FOUND');
  const upd: any = {};
  if (data.estado !== undefined) upd.estado = data.estado;
  if (data.tipoDocumento !== undefined) upd.tipoDocumento = data.tipoDocumento;
  if (data.fechaVencimiento !== undefined) upd.fechaVencimiento = data.fechaVencimiento ? new Date(data.fechaVencimiento) : null;
  if (data.observaciones !== undefined) upd.observaciones = data.observaciones;
  if (data.terminosPago !== undefined) upd.terminosPago = data.terminosPago;
  if (data.metodoPago !== undefined) upd.metodoPago = data.metodoPago;
  const f = await prisma.factura.update({
  where: { idFactura: facturaId }, data: upd, include: FACTURA_INCLUDE
  });
  revalidatePath('/busy/facturas');
  return {
    ...f,
    subtotal: Number(f.subtotal),
    total: Number(f.total),
    descuento: Number(f.descuento ?? 0),
    impuestos: Number(f.impuestos ?? 0),
    cargoTransporte: Number(f.cargoTransporte ?? 0),
    tasaCambio: f.tasaCambio ? Number(f.tasaCambio) : null,
  } as any;
});

export const deleteFacturaAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'facturacion', 'gestionar facturación');
  const tenantId = requireTenant(user);
  const ex = await prisma.factura.findFirst({ where: { idFactura: id, tenantId } });
  if (!ex) throw new ActionError('Factura no encontrada', 'NOT_FOUND');
  await prisma.factura.delete({ where: { idFactura: id } });
  revalidatePath('/busy/facturas');
  return { id, eliminado: true };
});
