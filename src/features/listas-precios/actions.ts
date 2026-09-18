/**
 * @description Server Actions para listas de precios.
 *
 * @module features/listas-precios/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { listaPrecioSchema, listaPrecioUpdateSchema } from './schemas';
import type { ListaPrecioInput, ListaPrecioUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const LISTA_SELECT = {
  id: true,
  nombre: true,
  descripcion: true,
  esDefault: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * @description Valida permisos y devuelve el tenant activo para operar listas de precios.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {string} Identificador del tenant activo.
 */
function requireListasPreciosManager(user: AuthenticatedUser): string {
  requirePermission(user, 'inventario.listas-precios.gestionar', 'gestionar listas de precios');
  requireFeature(user, 'listas-precios', 'gestionar listas de precios');
  return requireTenant(user);
}

export const getListasPreciosAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireListasPreciosManager(user);
  return prisma.listaPrecio.findMany({
    where: { tenantId },
    select: { ...LISTA_SELECT, _count: { select: { puntosDeVenta: true, precios: true } } },
    orderBy: { createdAt: 'desc' },
  });
});

export const getListaPrecioByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireListasPreciosManager(user);
  const lista = await prisma.listaPrecio.findFirst({
    where: { id, tenantId },
    select: { ...LISTA_SELECT, puntosDeVenta: { select: { pvId: true, nombre: true } } },
  });
  if (!lista) throw new ActionError('Lista de precios no encontrada', 'NOT_FOUND');
  return lista;
});

export const createListaPrecioAction = withAction(async (input: ListaPrecioInput, user: AuthenticatedUser) => {
  const tenantId = requireListasPreciosManager(user);
  const parsed = listaPrecioSchema.parse(input);

  if (parsed.esDefault) {
    await prisma.listaPrecio.updateMany({ where: { esDefault: true, tenantId }, data: { esDefault: false } });
  }

  const lista = await prisma.listaPrecio.create({
    data: { nombre: parsed.nombre, descripcion: parsed.descripcion ?? null, esDefault: parsed.esDefault ?? false, tenantId },
    select: LISTA_SELECT,
  });

  revalidatePath('/busy/listas-precios');
  return lista;
});

export const updateListaPrecioAction = withAction(async (input: ListaPrecioUpdateInput, user: AuthenticatedUser) => {
  const tenantId = requireListasPreciosManager(user);
  const parsed = listaPrecioUpdateSchema.parse(input);
  const { id, ...data } = parsed;

  const existing = await prisma.listaPrecio.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw new ActionError('Lista de precios no encontrada', 'NOT_FOUND');

  if (data.esDefault) {
    await prisma.listaPrecio.updateMany({ where: { esDefault: true, id: { not: id }, tenantId }, data: { esDefault: false } });
  }

  const lista = await prisma.listaPrecio.update({
    where: { id },
    data: {
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
      ...(data.esDefault !== undefined && { esDefault: data.esDefault }),
    },
    select: LISTA_SELECT,
  });

  revalidatePath('/busy/listas-precios');
  return lista;
});

export const deleteListaPrecioAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireListasPreciosManager(user);

  const existing = await prisma.listaPrecio.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw new ActionError('Lista de precios no encontrada', 'NOT_FOUND');

  const usoPuntoVenta = await prisma.puntoDeVenta.count({ where: { listaPrecioId: id } });
  if (usoPuntoVenta > 0) {
    throw new ActionError('No se puede eliminar una lista de precios asociada a un punto de venta', 'LISTA_PRECIO_IN_USE');
  }

  await prisma.listaPrecio.delete({ where: { id } });
  revalidatePath('/busy/listas-precios');
  return { id, eliminado: true };
});
