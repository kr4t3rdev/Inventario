/**
 * @description Server Actions para el feature de Almacenes.
 *
 * Reemplazan las llamadas a API routes + RTK Query por Server Actions
 * que usan Prisma directo en el servidor.
 *
 * Cada acción está envuelta con withAction() que provee:
 * - Autenticación automática (via getCurrentUser)
 * - Manejo estandarizado de errores (Zod, Prisma, ActionError)
 * - Formato consistente { success, data?/error? }
 *
 * @module features/almacenes/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { almacenSchema, almacenUpdateSchema } from './schemas';
import type { AlmacenInput, AlmacenUpdateInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── Select reutilizable ──────────────────────────────────

const ALMACEN_SELECT = {
  almacenId: true,
  nombre: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ─── Server Actions ───────────────────────────────────────

/**
 * @description Lista todos los almacenes del tenant autenticado.
 */
export const getAlmacenesAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  return prisma.almacen.findMany({
    where: { tenantId },
    select: ALMACEN_SELECT,
    orderBy: { createdAt: 'desc' },
  });
});

/**
 * @description Obtiene un almacén por ID, verificando que pertenezca al tenant.
 *
 * @throws ActionError si el almacén no existe
 */
export const getAlmacenByIdAction = withAction(async (almacenId: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);

  const almacen = await prisma.almacen.findFirst({
    where: { almacenId, tenantId },
    select: ALMACEN_SELECT,
  });

  if (!almacen) {
    throw new ActionError('Almacén no encontrado', 'NOT_FOUND');
  }

  return almacen;
});

/**
 * @description Crea un nuevo almacén con validación Zod.
 */
export const createAlmacenAction = withAction(async (input: AlmacenInput, user: AuthenticatedUser) => {
  const parsed = almacenSchema.parse(input);
  const tenantId = requireTenant(user);

  const almacen = await prisma.almacen.create({
    data: {
      nombre: parsed.nombre,
      tenantId,
    },
    select: ALMACEN_SELECT,
  });

  revalidatePath('/busy/almacen');
  return almacen;
});

/**
 * @description Actualiza un almacén existente.
 *
 * @throws ActionError si el almacén no existe
 */
export const updateAlmacenAction = withAction(async (input: AlmacenUpdateInput, user: AuthenticatedUser) => {
  const parsed = almacenUpdateSchema.parse(input);
  const { almacenId, ...updateData } = parsed;
  const tenantId = requireTenant(user);

  const existing = await prisma.almacen.findFirst({
    where: { almacenId, tenantId },
    select: { almacenId: true },
  });

  if (!existing) {
    throw new ActionError('Almacén no encontrado', 'NOT_FOUND');
  }

  const almacen = await prisma.almacen.update({
    where: { almacenId },
    data: {
      ...(updateData.nombre !== undefined && { nombre: updateData.nombre }),
    },
    select: ALMACEN_SELECT,
  });

  revalidatePath('/busy/almacen');
  return almacen;
});

/**
 * @description Elimina un almacén por ID, bloqueando el borrado si tiene dependencias.
 *
 * @throws ActionError si el almacén no existe
 * @throws ActionError con código ALMACEN_EN_USO si tiene productos, stock,
 * transferencias, mermas o puntos de venta asociados
 */
export const deleteAlmacenAction = withAction(async (almacenId: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);

  const existing = await prisma.almacen.findFirst({
    where: { almacenId, tenantId },
    select: { almacenId: true },
  });

  if (!existing) {
    throw new ActionError('Almacén no encontrado', 'NOT_FOUND');
  }

  const [productos, stock, transferencias, mermas, puntosVenta] = await Promise.all([
    prisma.producto.count({ where: { almacenId, tenantId } }),
    prisma.stockUbicacion.count({ where: { ubicacionId: almacenId, tipoUbicacion: 'almacen', tenantId } }),
    prisma.transferencia.count({ where: { tenantId, OR: [{ origenId: almacenId }, { destinoId: almacenId }] } }),
    prisma.merma.count({ where: { almacenId, tenantId } }),
    prisma.puntoDeVenta.count({ where: { almacenId, tenantId } }),
  ]);

  if (productos + stock + transferencias + mermas + puntosVenta > 0) {
    throw new ActionError(
      `No se puede eliminar el almacén porque tiene registros asociados: ${productos} producto(s), ${stock} registro(s) de stock, ${transferencias} transferencia(s), ${mermas} merma(s), ${puntosVenta} punto(s) de venta.`,
      'ALMACEN_EN_USO',
    );
  }

  await prisma.almacen.delete({ where: { almacenId } });
  revalidatePath('/busy/almacen');

  return { id: almacenId, eliminado: true };
});
