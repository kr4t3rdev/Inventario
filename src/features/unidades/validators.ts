/**
 * @description Validaciones de dominio para Unidades.
 *
 * Contiene lógica de validación que va más allá del schema Zod
 * (ej. unicidad de nombre/símbolo scoped por tenant),
 * manteniendo las Server Actions limpias y enfocadas en orquestación.
 */
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';

/**
 * @description Parámetros para la verificación de unicidad.
 */
interface UniquenessCheckParams {
  /** Nombre a verificar (opcional, si se omite salta la verificación de nombre) */
  nombre?: string;
  /** Símbolo a verificar (opcional) */
  simbolo?: string;
  /** ID a excluir de la búsqueda (útil en updates: permite self-update) */
  excludeId?: string;
  /** Tenant ID requerido — scoped uniqueness */
  tenantId: string;
}

/**
 * @description Verifica que `nombre` y/o `simbolo` sean únicos dentro del tenant.
 *
 * Si encuentra un duplicado, lanza `ActionError` con código `CONFLICT`.
 * Si se proporciona `excludeId`, se excluye ese registro de la búsqueda
 * (permite que un PUT/PATCH del mismo registro con los mismos valores pase).
 *
 * La protección atómica real es el unique constraint de Prisma (P2002);
 * este pre-check existe solo para mensajes de error más amigables y rápidos.
 *
 * @param params - Parámetros de verificación
 * @throws ActionError si el nombre o símbolo ya existen en el tenant
 */
export async function checkUnidadUniqueness(params: UniquenessCheckParams): Promise<void> {
  const { nombre, simbolo, excludeId, tenantId } = params;

  if (nombre) {
    const existingNombre = await prisma.unidad.findFirst({
      where: {
        nombre,
        tenantId,
        ...(excludeId ? { NOT: { unidadId: excludeId } } : {}),
      },
      select: { unidadId: true },
    });

    if (existingNombre) {
      throw new ActionError(
        `Ya existe una unidad con el nombre '${nombre}'`,
        'CONFLICT'
      );
    }
  }

  if (simbolo) {
    const existingSimbolo = await prisma.unidad.findFirst({
      where: {
        simbolo,
        tenantId,
        ...(excludeId ? { NOT: { unidadId: excludeId } } : {}),
      },
      select: { unidadId: true },
    });

    if (existingSimbolo) {
      throw new ActionError(
        `Ya existe una unidad con el símbolo '${simbolo}'`,
        'CONFLICT'
      );
    }
  }
}
