import prisma from '@/lib/prisma';

export interface PeriodosResolved {
  periodoDiarioId: string | null;
  periodoMensualId: string | null;
  periodoAnualId: string | null;
}

interface PersistedPeriodoMinimal {
  periodoId: string;
  tipo: string;
}

interface PeriodoContableQueryModel {
  findMany: (args: Record<string, unknown>) => Promise<PersistedPeriodoMinimal[]>;
}

function resolveModel(client: unknown): PeriodoContableQueryModel | null {
  const candidate = client as Record<string, unknown>;
  const periodoContable = candidate.periodoContable as PeriodoContableQueryModel | undefined;
  if (periodoContable?.findMany) return periodoContable;
  return null;
}

/**
 * @description Resuelve los IDs de período (diario, mensual, anual) para una fecha operativa.
 * Busca períodos ABIERTOS o REABIERTOS que contengan la fecha.
 * @param {Date} fechaOperacion - Fecha de la operación contable.
 * @returns {Promise<PeriodosResolved>} IDs de período resueltos (null si no se encuentra).
 */
export async function resolvePeriodosFromFecha(fechaOperacion: Date): Promise<PeriodosResolved> {
  const model = resolveModel(prisma);
  if (!model) {
    return { periodoDiarioId: null, periodoMensualId: null, periodoAnualId: null };
  }

  const periodos = await model.findMany({
    where: {
      fechaInicio: { lte: fechaOperacion },
      fechaFin: { gte: fechaOperacion },
      estado: { in: ['ABIERTO', 'REABIERTO'] },
    },
    select: { periodoId: true, tipo: true },
  } as Record<string, unknown>);

  const result: PeriodosResolved = {
    periodoDiarioId: null,
    periodoMensualId: null,
    periodoAnualId: null,
  };

  for (const p of periodos) {
    if (p.tipo === 'DIARIO') result.periodoDiarioId = p.periodoId;
    if (p.tipo === 'MENSUAL') result.periodoMensualId = p.periodoId;
    if (p.tipo === 'ANUAL') result.periodoAnualId = p.periodoId;
  }

  return result;
}
