'use server';
import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { pvSchema, pvUpdateSchema } from './schemas';
import type { PvInput, PvUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getPuntosDeVentaAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  return prisma.puntoDeVenta.findMany({
    where: { tenantId },
    include: { listaPrecio: true },
    orderBy: { nombre: 'asc' },
  });
});

export const getPuntoDeVentaByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const pv = await prisma.puntoDeVenta.findFirst({
    where: { pvId: id, tenantId },
    include: { listaPrecio: true },
  });
  if (!pv) throw new ActionError('Punto de venta no encontrado', 'NOT_FOUND');
  return pv;
});

export const createPuntoDeVentaAction = withAction(async (input: PvInput, user: AuthenticatedUser) => {
  const parsed = pvSchema.parse(input);
  const tenantId = requireTenant(user);
  const pv = await prisma.puntoDeVenta.create({
  // @ts-expect-error
    data: {
      nombre: parsed.nombre,
      ubicacion: parsed.ubicacion ?? null,
      tenantId,
      ...(parsed.listaPrecioId ? { listaPrecio: { connect: { id: parsed.listaPrecioId } } } : {}),
    },
  });
  revalidatePath('/busy/puntosDeVenta');
  return pv;
});

export const updatePuntoDeVentaAction = withAction(async (input: PvUpdateInput, user: AuthenticatedUser) => {
  const parsed = pvUpdateSchema.parse(input);
  const { pvId, ...data } = parsed;
  const tenantId = requireTenant(user);
  const existing = await prisma.puntoDeVenta.findFirst({ where: { pvId, tenantId } });
  if (!existing) throw new ActionError('Punto de venta no encontrado', 'NOT_FOUND');
  const pv = await prisma.puntoDeVenta.update({
    where: { pvId },
    data: {
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(data.ubicacion !== undefined && { ubicacion: data.ubicacion }),
      ...(data.listaPrecioId !== undefined && {
        listaPrecio: data.listaPrecioId ? { connect: { id: data.listaPrecioId } } : { disconnect: true },
      }),
    },
  });
  revalidatePath('/busy/puntosDeVenta');
  return pv;
});

export const deletePuntoDeVentaAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const existing = await prisma.puntoDeVenta.findFirst({ where: { pvId: id, tenantId } });
  if (!existing) throw new ActionError('Punto de venta no encontrado', 'NOT_FOUND');
  await prisma.puntoDeVenta.delete({ where: { pvId: id } });
  revalidatePath('/busy/puntosDeVenta');
  return { success: true, id };
});
