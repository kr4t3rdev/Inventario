/**
 * @description Server Actions para el feature de Unidades.
 *
 * Unidad ahora es un modelo tenant-scoped (v2).
 * Cada tenant tiene su propio catálogo de unidades independiente.
 *
 * @module features/unidades/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import type { UnidadDimension } from '@/generated/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { unidadSchema, unidadUpdateSchema } from './schemas';
import { checkUnidadUniqueness } from './validators';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { UnidadFormInput, UnidadUpdateInput } from './schemas';

// ─── Select reutilizable ──────────────────────────────────

const UNIDAD_SELECT = {
  unidadId: true,
  tenantId: true,
  nombre: true,
  simbolo: true,
  dimension: true,
  createdAt: true,
  updatedAt: true,
} as const;

type UnidadRow = {
  unidadId: string;
  tenantId: string;
  nombre: string;
  simbolo: string;
  dimension: UnidadDimension;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Serialización ────────────────────────────────────────

/**
 * @description Convierte las fechas de un registro Prisma a ISO strings
 * para consumo en el cliente.
 */
function serializeUnidad(u: UnidadRow) {
  return {
    ...u,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

/**
 * @description Mapea el código de error Prisma P2002 (unique constraint violation)
 * a un mensaje amigable.
 */
function rethrowP2002(error: unknown, existing?: { nombre?: string; simbolo?: string }): never {
  const err = error as Record<string, unknown>;
  if (err?.code === 'P2002') {
    const meta = err.meta as Record<string, unknown> | undefined;
    const target = (meta?.target ?? []) as string[];
    if (target.includes('nombre')) {
      throw new ActionError(
        `Ya existe una unidad con el nombre '${existing?.nombre ?? 'desconocido'}'`,
        'CONFLICT'
      );
    }
    if (target.includes('simbolo')) {
      throw new ActionError(
        `Ya existe una unidad con el símbolo '${existing?.simbolo ?? 'desconocido'}'`,
        'CONFLICT'
      );
    }
    throw new ActionError('Ya existe una unidad con esos valores', 'CONFLICT');
  }
  throw error;
}

// ─── Server Actions ───────────────────────────────────────

/**
 * @description Lista las unidades del tenant del usuario autenticado.
 */
export const getUnidadesAction = withAction(async (
  _input: void,
  user: AuthenticatedUser
) => {
  const tenantId = requireTenant(user);
  return prisma.unidad.findMany({
    where: { tenantId },
    select: UNIDAD_SELECT,
    orderBy: { nombre: 'asc' },
  }).then((rows) => rows.map(serializeUnidad));
});

/**
 * @description Obtiene una unidad por ID, verificando pertenencia al tenant.
 *
 * @throws ActionError si la unidad no existe o no pertenece al tenant
 */
export const getUnidadByIdAction = withAction(async (
  unidadId: string,
  user: AuthenticatedUser
) => {
  const tenantId = requireTenant(user);

  const unidad = await prisma.unidad.findUnique({
    where: { unidadId },
    select: UNIDAD_SELECT,
  });

  if (!unidad || unidad.tenantId !== tenantId) {
    throw new ActionError('Unidad no encontrada', 'NOT_FOUND');
  }

  return serializeUnidad(unidad);
});

/**
 * @description Crea una nueva unidad de medida scoped al tenant.
 */
export const createUnidadAction = withAction(async (
  input: UnidadFormInput,
  user: AuthenticatedUser
) => {
  const parsed = unidadSchema.parse(input);
  const tenantId = requireTenant(user);

  // Pre-check de unicidad (rápido, mensaje amigable)
  await checkUnidadUniqueness({
    nombre: parsed.nombre,
    simbolo: parsed.simbolo,
    tenantId,
  });

  try {
    const unidad = await prisma.unidad.create({
      data: {
        nombre: parsed.nombre,
        simbolo: parsed.simbolo,
        dimension: parsed.dimension,
        tenantId,
      },
      select: UNIDAD_SELECT,
    });

    revalidatePath('/busy/unidad');
    return serializeUnidad(unidad);
  } catch (error) {
    // Fallback atómico: si el pre-check no detectó duplicado por race condition,
    // Prisma lanza P2002. Lo convertimos a mensaje amigable.
    rethrowP2002(error, parsed);
  }
});

/**
 * @description Actualiza una unidad existente, verificando pertenencia al tenant.
 *
 * @throws ActionError si la unidad no existe o no pertenece al tenant
 */
export const updateUnidadAction = withAction(async (
  input: UnidadUpdateInput,
  user: AuthenticatedUser
) => {
  const parsed = unidadUpdateSchema.parse(input);
  const { unidadId, ...updateData } = parsed;
  const tenantId = requireTenant(user);

  const existing = await prisma.unidad.findUnique({
    where: { unidadId },
    select: { unidadId: true, tenantId: true, nombre: true, simbolo: true },
  });

  if (!existing || existing.tenantId !== tenantId) {
    throw new ActionError('Unidad no encontrada', 'NOT_FOUND');
  }

  // Pre-check de unicidad solo para campos que cambian
  await checkUnidadUniqueness({
    nombre: updateData.nombre !== undefined ? updateData.nombre : undefined,
    simbolo: updateData.simbolo !== undefined ? updateData.simbolo : undefined,
    excludeId: unidadId,
    tenantId,
  });

  try {
    const unidad = await prisma.unidad.update({
      where: { unidadId },
      data: {
        ...(updateData.nombre !== undefined && { nombre: updateData.nombre }),
        ...(updateData.simbolo !== undefined && { simbolo: updateData.simbolo }),
      },
      select: UNIDAD_SELECT,
    });

    revalidatePath('/busy/unidad');
    return serializeUnidad(unidad);
  } catch (error) {
    rethrowP2002(error, {
      nombre: updateData.nombre ?? existing.nombre,
      simbolo: updateData.simbolo ?? existing.simbolo,
    });
  }
});

/**
 * @description Elimina una unidad, verificando que no esté en uso por productos.
 *
 * @throws ActionError si la unidad no existe, no pertenece al tenant, o está en uso
 */
export const deleteUnidadAction = withAction(async (
  unidadId: string,
  user: AuthenticatedUser
) => {
  const tenantId = requireTenant(user);

  const existing = await prisma.unidad.findUnique({
    where: { unidadId },
    select: { unidadId: true, tenantId: true },
  });

  if (!existing || existing.tenantId !== tenantId) {
    throw new ActionError('Unidad no encontrada', 'NOT_FOUND');
  }

  // Verificar que ningún producto use esta unidad
  const enUso = await prisma.producto.count({
    where: { unidadId },
  });

  if (enUso > 0) {
    throw new ActionError(
      `No se puede eliminar: está en uso por ${enUso} producto(s)`,
      'IN_USE'
    );
  }

  await prisma.unidad.delete({ where: { unidadId } });
  revalidatePath('/busy/unidad');

  return { id: unidadId, eliminado: true };
});
