import prisma from '@/lib/prisma';

import {
  canRegisterOperations,
  ESTADO_PERIODO,
  TIPO_PERIODO,
  PERIOD_POLICY,
  ACTIVE_PERIOD_POLICY,
  type EstadoPeriodo,
  type TipoPeriodo,
} from '@/lib/services/periodo-contable-service';

export class PeriodoOperacionError extends Error {
  status: number;
  code: string;

  /**
   * @description Construye un error de bloqueo de período con metadata HTTP.
   * @param {string} message - Mensaje legible del error.
   * @param {number} status - Código HTTP a devolver.
   * @param {string} code - Código de negocio estable.
   */
  constructor(
    message: string,
    status = 409,
    code = 'PERIODO_BLOQUEADO'
  ) {
    super(message);
    this.name = 'PeriodoOperacionError';
    this.status = status;
    this.code = code;
  }
}

interface PeriodoEncontrado {
  periodoId: string;
  codigo: string;
  tipo: TipoPeriodo;
  estado: EstadoPeriodo;
}

/**
 * @description Indica si un error proviene del guard de períodos.
 * @param {unknown} error - Error a inspeccionar.
 * @returns {boolean} Verdadero si el error pertenece al guard.
 */
export function isPeriodoOperacionError(
  error: unknown
): error is PeriodoOperacionError {
  return error instanceof PeriodoOperacionError;
}

/**
 * @description Normaliza la fecha operativa a un objeto `Date` seguro.
 * @param {Date | string | undefined} fecha - Fecha operativa opcional.
 * @returns {Date} Fecha válida.
 */
export function resolveOperationDate(fecha?: Date | string): Date {
  if (fecha instanceof Date) {
    return fecha;
  }

  if (typeof fecha === 'string') {
    const parsed = new Date(fecha);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

/**
 * @description Valida si una operación puede registrarse según los períodos configurados.
 * @param {Date | string | undefined} fechaOperacion - Fecha efectiva de la operación.
 * @param {string} contexto - Nombre del flujo que intenta registrar la operación.
 * @returns {Promise<void>} No retorna valor si la operación está permitida.
 */
export async function assertOperationAllowed(
  fechaOperacion?: Date | string,
  contexto = 'OPERACION'
): Promise<void> {
  const periodoModel = (prisma as unknown as Record<string, unknown>).periodoContable as
    | {
        findMany?: (args: Record<string, unknown>) => Promise<PeriodoEncontrado[]>;
      }
    | undefined;

  if (!periodoModel?.findMany) {
    return;
  }

  const fecha = resolveOperationDate(fechaOperacion);

  const periodos = await periodoModel.findMany({
    where: {
      fechaInicio: { lte: fecha },
      fechaFin: { gte: fecha },
      tipo: {
        in: [TIPO_PERIODO.DIARIO, TIPO_PERIODO.MENSUAL, TIPO_PERIODO.ANUAL],
      },
    },
    select: {
      periodoId: true,
      codigo: true,
      tipo: true,
      estado: true,
    },
    orderBy: [{ fechaInicio: 'desc' }],
  });

  if (!Array.isArray(periodos) || periodos.length === 0) {
    const mensaje = `No hay períodos contables activos para la fecha ${fecha.toISOString().split('T')[0]}. La operación ${contexto} requiere un período ABIERTO.`;

    if (ACTIVE_PERIOD_POLICY === PERIOD_POLICY.STRICT) {
      throw new PeriodoOperacionError(mensaje, 409, 'PERIODO_NO_ENCONTRADO');
    }

    console.warn(`[PeriodoGuard] PERMISSIVE — ${mensaje}`);
    return;
  }

  const bloqueados = periodos.filter(
    (periodo) => !canRegisterOperations(periodo.estado)
  );

  if (bloqueados.length === 0) {
    return;
  }

  const detalle = bloqueados
    .map((periodo) => `${periodo.tipo}:${periodo.codigo}(${periodo.estado})`)
    .join(', ');

  throw new PeriodoOperacionError(
    `La operación ${contexto} está bloqueada por período contable: ${detalle}.`
  );
}

/**
 * @description Obtiene un mensaje serializable desde un error de período.
 * @param {PeriodoOperacionError} error - Error a serializar.
 * @returns {{ error: string; code: string }} Payload de respuesta.
 */
export function serializePeriodoOperacionError(error: PeriodoOperacionError): {
  error: string;
  code: string;
} {
  return {
    error: error.message,
    code: error.code,
  };
}

export const PERIODOS_BLOQUEANTES_POR_DEFECTO = [
  ESTADO_PERIODO.BORRADOR,
  ESTADO_PERIODO.EN_CIERRE,
  ESTADO_PERIODO.CERRADO,
  ESTADO_PERIODO.APROBADO,
] as const;
