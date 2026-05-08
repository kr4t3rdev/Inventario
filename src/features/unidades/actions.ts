/**
 * @description Server Actions para el feature de Unidades.
 *
 * NOTA: Unidad es un modelo GLOBAL (sin tenantId),
 * visible para todos los tenants.
 *
 * @module features/unidades/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { unidadSchema, unidadUpdateSchema } from './schemas';
import type { UnidadInput, UnidadUpdateInput } from './schemas';

// ─── Select reutilizable ──────────────────────────────────

const UNIDAD_SELECT = {
  unidadId: true,
  nombre: true,
  simbolo: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ─── Server Actions ───────────────────────────────────────

/**
 * @description Lista todas las unidades (global, sin tenant).
 */
export const getUnidadesAction = withAction(async (_input: void) => {
  return prisma.unidad.findMany({
    select: UNIDAD_SELECT,
    orderBy: { nombre: 'asc' },
  });
});

/**
 * @description Obtiene una unidad por ID.
 *
 * @throws ActionError si la unidad no existe
 */
export const getUnidadByIdAction = withAction(async (unidadId: string) => {
  const unidad = await prisma.unidad.findUnique({
    where: { unidadId },
    select: UNIDAD_SELECT,
  });

  if (!unidad) {
    throw new ActionError('Unidad no encontrada', 'NOT_FOUND');
  }

  return unidad;
});

/**
 * @description Crea una nueva unidad de medida.
 */
export const createUnidadAction = withAction(async (input: UnidadInput) => {
  const parsed = unidadSchema.parse(input);

  const unidad = await prisma.unidad.create({
    data: {
      nombre: parsed.nombre,
      simbolo: parsed.simbolo,
    },
    select: UNIDAD_SELECT,
  });

  revalidatePath('/busy/unidad');
  return unidad;
});

/**
 * @description Actualiza una unidad existente.
 *
 * @throws ActionError si la unidad no existe
 */
export const updateUnidadAction = withAction(async (input: UnidadUpdateInput) => {
  const parsed = unidadUpdateSchema.parse(input);
  const { unidadId, ...updateData } = parsed;

  const existing = await prisma.unidad.findUnique({
    where: { unidadId },
    select: { unidadId: true },
  });

  if (!existing) {
    throw new ActionError('Unidad no encontrada', 'NOT_FOUND');
  }

  const unidad = await prisma.unidad.update({
    where: { unidadId },
    data: {
      ...(updateData.nombre !== undefined && { nombre: updateData.nombre }),
      ...(updateData.simbolo !== undefined && { simbolo: updateData.simbolo }),
    },
    select: UNIDAD_SELECT,
  });

  revalidatePath('/busy/unidad');
  return unidad;
});

/**
 * @description Elimina una unidad por ID.
 *
 * @throws ActionError si la unidad no existe
 */
export const deleteUnidadAction = withAction(async (unidadId: string) => {
  const existing = await prisma.unidad.findUnique({
    where: { unidadId },
    select: { unidadId: true },
  });

  if (!existing) {
    throw new ActionError('Unidad no encontrada', 'NOT_FOUND');
  }

  await prisma.unidad.delete({ where: { unidadId } });
  revalidatePath('/busy/unidad');

  return { id: unidadId, eliminado: true };
});
