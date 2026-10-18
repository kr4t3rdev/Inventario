'use server';
import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { pvSchema, pvUpdateSchema } from './schemas';
import type { PvInput, PvUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getPuntosDeVentaAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  requireFeature(user, 'puntos-venta', 'gestionar puntos de venta');
  const tenantId = requireTenant(user);
  return prisma.puntoDeVenta.findMany({
    where: { tenantId },
    include: { listaPrecio: true },
    orderBy: { nombre: 'asc' },
  });
});

export const getPuntoDeVentaByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'puntos-venta', 'gestionar puntos de venta');
  const tenantId = requireTenant(user);
  const pv = await prisma.puntoDeVenta.findFirst({
    where: { pvId: id, tenantId },
    include: { listaPrecio: true },
  });
  if (!pv) throw new ActionError('Punto de venta no encontrado', 'NOT_FOUND');
  return pv;
});

export const createPuntoDeVentaAction = withAction(async (input: PvInput, user: AuthenticatedUser) => {
  requireFeature(user, 'puntos-venta', 'gestionar puntos de venta');
  const parsed = pvSchema.parse(input);
  const tenantId = requireTenant(user);
  if (parsed.listaPrecioId) {
    requireFeature(user, 'listas-precios', 'asignar lista de precios a un punto de venta');
  }
  const pv = await prisma.puntoDeVenta.create({
    data: {
      nombre: parsed.nombre,
      ubicacion: parsed.ubicacion ?? null,
      tenantId,
      listaPrecioId: parsed.listaPrecioId ?? null,
    },
  });
  revalidatePath('/busy/puntosDeVenta');
  return pv;
});

export const updatePuntoDeVentaAction = withAction(async (input: PvUpdateInput, user: AuthenticatedUser) => {
  requireFeature(user, 'puntos-venta', 'gestionar puntos de venta');
  const parsed = pvUpdateSchema.parse(input);
  const { pvId, ...data } = parsed;
  const tenantId = requireTenant(user);
  if (data.listaPrecioId) {
    requireFeature(user, 'listas-precios', 'asignar lista de precios a un punto de venta');
  }
  const existing = await prisma.puntoDeVenta.findFirst({ where: { pvId, tenantId } });
  if (!existing) throw new ActionError('Punto de venta no encontrado', 'NOT_FOUND');
  const pv = await prisma.puntoDeVenta.update({
    where: { pvId },
    data: {
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(data.ubicacion !== undefined && { ubicacion: data.ubicacion }),
      ...(data.listaPrecioId !== undefined && { listaPrecioId: data.listaPrecioId }),
    },
  });
  revalidatePath('/busy/puntosDeVenta');
  return pv;
});

export const deletePuntoDeVentaAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'puntos-venta', 'gestionar puntos de venta');
  const tenantId = requireTenant(user);
  const existing = await prisma.puntoDeVenta.findFirst({ where: { pvId: id, tenantId } });
  if (!existing) throw new ActionError('Punto de venta no encontrado', 'NOT_FOUND');

  const [productos, ventas, turnos, arqueos, transferencias] = await Promise.all([
    prisma.producto.count({ where: { puntoDeVentaId: id, tenantId } }),
    prisma.venta.count({ where: { puntoDeVentaId: id, tenantId } }),
    prisma.turnoPuntoVenta.count({ where: { puntoDeVentaId: id, tenantId } }),
    prisma.arqueoCaja.count({ where: { puntoDeVentaId: id, tenantId } }),
    prisma.transferencia.count({
      where: { tenantId, OR: [{ puntoDeVentaOrigenId: id }, { puntoDeVentaDestinoId: id }] },
    }),
  ]);

  const total = productos + ventas + turnos + arqueos + transferencias;
  if (total > 0) {
    throw new ActionError(
      `No se puede eliminar el punto de venta porque tiene registros asociados: ${productos} producto(s), ${ventas} venta(s), ${turnos} turno(s), ${arqueos} arqueo(s), ${transferencias} transferencia(s).`,
      'PUNTO_VENTA_EN_USO',
    );
  }

  await prisma.puntoDeVenta.delete({ where: { pvId: id } });
  revalidatePath('/busy/puntosDeVenta');
  return { success: true, id };
});
