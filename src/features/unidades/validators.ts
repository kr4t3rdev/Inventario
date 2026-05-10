/**
 * @description Validaciones de dominio para Unidades.
 *
 * Contiene lógica de validación que va más allá del schema Zod
 * (ej. unicidad de nombre/símbolo), manteniendo las Server Actions
 * limpias y enfocadas en orquestación.
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
}

/**
 * @description Verifica que `nombre` y/o `simbolo` sean únicos en toda la tabla.
 *
 * Si encuentra un duplicado, lanza `ActionError` con código `CONFLICT`.
 * Si se proporciona `excludeId`, se excluye ese registro de la búsqueda
 * (permite que un PUT/PATCH del mismo registro con los mismos valores pase).
 *
 * @param params - Parámetros de verificación
 * @throws ActionError si el nombre o símbolo ya existen
 */
export async function checkUnidadUniqueness(params: UniquenessCheckParams): Promise<void> {
  const { nombre, simbolo, excludeId } = params;

  if (nombre) {
    const existingNombre = await prisma.unidad.findFirst({
      where: {
        nombre,
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
