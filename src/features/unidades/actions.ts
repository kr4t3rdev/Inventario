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
import type { Prisma, UnidadDimension } from '@/generated/prisma';
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

/**
 * @description Valida las referencias actuales antes de cambiar la dimensión de una unidad.
 * @param {Prisma.TransactionClient} tx - Cliente transaccional de Prisma.
 * @param {string} tenantId - Tenant propietario de la unidad.
 * @param {string} unidadId - Unidad cuya dimensión cambiará.
 * @param {UnidadDimension} currentDimension - Dimensión vigente leída dentro de la transacción.
 * @param {UnidadDimension} nextDimension - Dimensión solicitada.
 * @returns {Promise<void>} No retorna valor; lanza CONFLICT si hay referencias incompatibles.
 */
async function validateDimensionTransition(
  tx: Prisma.TransactionClient,
  tenantId: string,
  unidadId: string,
  currentDimension: UnidadDimension,
  nextDimension: UnidadDimension,
  hasProductReference: boolean
): Promise<void> {
  const conversions = await tx.unidadConversion.findMany({
    where: { tenantId, OR: [{ unidadId }, { baseUnidadId: unidadId }] },
    select: { unidadId: true, baseUnidadId: true },
  });

  const isInUse = hasProductReference || conversions.length > 0;
  if (currentDimension !== 'UNKNOWN' && currentDimension !== nextDimension && isInUse) {
    throw new ActionError(
      'No se puede cambiar la dimensión de una unidad conocida mientras esté en uso',
      'CONFLICT'
    );
  }

  if (currentDimension !== 'UNKNOWN' || nextDimension === 'UNKNOWN') return;

  const otherUnitIds = [...new Set(conversions.flatMap(({ unidadId: sourceId, baseUnidadId }) =>
    sourceId === unidadId ? baseUnidadId : sourceId
  ).filter((id) => id !== unidadId))];
  if (otherUnitIds.length === 0) return;

  const otherUnits = await tx.unidad.findMany({
    where: { tenantId, unidadId: { in: otherUnitIds } },
    select: { unidadId: true, dimension: true },
  });
  const dimensionsByUnitId = new Map(otherUnits.map((unit) => [unit.unidadId, unit.dimension]));
  const hasIncompatibleMapping = conversions.some(({ unidadId: sourceId, baseUnidadId }) => {
    if (sourceId === baseUnidadId) return false;
    const otherUnitId = sourceId === unidadId ? baseUnidadId : sourceId;
    return dimensionsByUnitId.get(otherUnitId) !== nextDimension;
  });

  if (hasIncompatibleMapping) {
    throw new ActionError(
      'No se puede clasificar la unidad: tiene conversiones con dimensiones desconocidas o incompatibles',
      'CONFLICT'
    );
  }
}

/**
 * @description Obtiene solo indicadores de referencias globales a la unidad.
 * @param {Prisma.TransactionClient} tx - Cliente transaccional.
 * @param {string} tenantId - Tenant propietario.
 * @param {string} unidadId - Identificador global de la unidad.
 * @returns {Promise<{ hasProductReference: boolean; hasForeignProductReference: boolean }>} Estado agregado.
 */
async function getProductReferenceState(
  tx: Prisma.TransactionClient,
  tenantId: string,
  unidadId: string
): Promise<{ hasProductReference: boolean; hasForeignProductReference: boolean }> {
  const rows = await tx.$queryRaw<Array<{
    hasProductReference: boolean;
    hasForeignProductReference: boolean;
  }>>`
    SELECT
      EXISTS (SELECT 1 FROM "Producto" WHERE "unidadId" = ${unidadId}) AS "hasProductReference",
      EXISTS (
        SELECT 1 FROM "Producto"
        WHERE "unidadId" = ${unidadId}
          AND "tenantId" IS DISTINCT FROM ${tenantId}
      ) AS "hasForeignProductReference"
  `;
  const state = rows[0];
  if (!state || typeof state.hasProductReference !== 'boolean' ||
      typeof state.hasForeignProductReference !== 'boolean') {
    throw new ActionError('No se pudo validar el uso de la unidad', 'CONFLICT');
  }
  return state;
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
    select: { unidadId: true, tenantId: true, nombre: true, simbolo: true, dimension: true },
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
    const requestedDimension = updateData.dimension;
    const fieldsToUpdate = {
      ...(updateData.nombre !== undefined && { nombre: updateData.nombre }),
      ...(updateData.simbolo !== undefined && { simbolo: updateData.simbolo }),
      ...(updateData.dimension !== undefined && { dimension: updateData.dimension }),
    };
    const unidad = requestedDimension !== undefined
      ? await prisma.$transaction(async (tx) => {
          const locked = await tx.$queryRaw<Array<{ unidadId: string }>>`
            SELECT "unidadId" FROM "Unidad"
            WHERE "unidadId" = ${unidadId} AND "tenantId" = ${tenantId}
            FOR UPDATE
          `;
          if (!locked.some((row) => row.unidadId === unidadId)) {
            throw new ActionError('Unidad no encontrada', 'NOT_FOUND');
          }

          const current = await tx.unidad.findUnique({
            where: { tenantId_unidadId: { tenantId, unidadId } },
            select: { unidadId: true, dimension: true },
          });
          if (!current) throw new ActionError('Unidad no encontrada', 'NOT_FOUND');

          if (current.dimension !== requestedDimension) {
            const productReferences = await getProductReferenceState(tx, tenantId, unidadId);
            if (productReferences.hasForeignProductReference) {
              throw new ActionError('No se puede cambiar la dimensión de la unidad', 'CONFLICT');
            }
            await validateDimensionTransition(
              tx,
              tenantId,
              unidadId,
              current.dimension,
              requestedDimension,
              productReferences.hasProductReference
            );
          }

          return tx.unidad.update({
            where: { tenantId_unidadId: { tenantId, unidadId } },
            data: fieldsToUpdate,
            select: UNIDAD_SELECT,
          });
        }, { isolationLevel: 'ReadCommitted' })
      : await prisma.unidad.update({
          where: { tenantId_unidadId: { tenantId, unidadId } },
          data: fieldsToUpdate,
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
