import {
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfYear,
} from 'date-fns';

export const TIPO_PERIODO = {
  DIARIO: 'DIARIO',
  MENSUAL: 'MENSUAL',
  ANUAL: 'ANUAL',
} as const;

export const ESTADO_PERIODO = {
  BORRADOR: 'BORRADOR',
  ABIERTO: 'ABIERTO',
  EN_CIERRE: 'EN_CIERRE',
  CERRADO: 'CERRADO',
  APROBADO: 'APROBADO',
  REABIERTO: 'REABIERTO',
} as const;

export type TipoPeriodo = (typeof TIPO_PERIODO)[keyof typeof TIPO_PERIODO];
export type EstadoPeriodo = (typeof ESTADO_PERIODO)[keyof typeof ESTADO_PERIODO];

export interface PeriodoContableBase {
  tipo: TipoPeriodo;
  codigo: string;
  fechaInicio: Date;
  fechaFin: Date;
  estado: EstadoPeriodo;
  periodoPadreId?: string | null;
}

export interface ChildPeriodSummary {
  codigo: string;
  estado: EstadoPeriodo;
}

export interface CloseValidationResult {
  ok: boolean;
  reason?: string;
  blockers: string[];
}

/**
 * @description Construye el rango de fechas canónico para un período contable.
 * @param {TipoPeriodo} tipo - Nivel temporal del período.
 * @param {Date} referencia - Fecha que actúa como ancla.
 * @returns {{ fechaInicio: Date; fechaFin: Date }} Rango completo del período.
 */
export function buildPeriodRange(
  tipo: TipoPeriodo,
  referencia: Date
): { fechaInicio: Date; fechaFin: Date } {
  if (tipo === TIPO_PERIODO.DIARIO) {
    return {
      fechaInicio: startOfDay(referencia),
      fechaFin: endOfDay(referencia),
    };
  }

  if (tipo === TIPO_PERIODO.MENSUAL) {
    return {
      fechaInicio: startOfMonth(referencia),
      fechaFin: endOfMonth(referencia),
    };
  }

  return {
    fechaInicio: startOfYear(referencia),
    fechaFin: endOfYear(referencia),
  };
}

/**
 * @description Genera un código legible y estable para un período contable.
 * @param {TipoPeriodo} tipo - Tipo del período.
 * @param {Date} referencia - Fecha base para derivar el código.
 * @returns {string} Código único legible por humanos.
 */
export function buildPeriodCode(tipo: TipoPeriodo, referencia: Date): string {
  if (tipo === TIPO_PERIODO.DIARIO) {
    return `D-${format(referencia, 'yyyy-MM-dd')}`;
  }

  if (tipo === TIPO_PERIODO.MENSUAL) {
    return `M-${format(referencia, 'yyyy-MM')}`;
  }

  return `A-${format(referencia, 'yyyy')}`;
}

/**
 * @description Determina si un período admite registrar operaciones nuevas.
 * @param {EstadoPeriodo} estado - Estado actual del período.
 * @returns {boolean} Verdadero si el período acepta operaciones.
 */
export function canRegisterOperations(estado: EstadoPeriodo): boolean {
  return (
    estado === ESTADO_PERIODO.ABIERTO ||
    estado === ESTADO_PERIODO.REABIERTO
  );
}

/**
 * @description Calcula el próximo estado válido al abrir un período.
 * @param {EstadoPeriodo} estadoActual - Estado actual.
 * @returns {EstadoPeriodo} Estado resultante.
 */
export function resolveOpenStatus(estadoActual: EstadoPeriodo): EstadoPeriodo {
  if (estadoActual === ESTADO_PERIODO.BORRADOR) {
    return ESTADO_PERIODO.ABIERTO;
  }

  if (estadoActual === ESTADO_PERIODO.CERRADO) {
    return ESTADO_PERIODO.REABIERTO;
  }

  return estadoActual;
}

/**
 * @description Valida si un período puede cerrarse según su estado y sus hijos.
 * @param {PeriodoContableBase} periodo - Período que se quiere cerrar.
 * @param {ChildPeriodSummary[]} subperiodos - Resumen de hijos dependientes.
 * @returns {CloseValidationResult} Resultado con bloqueos detallados.
 */
export function validateClosePeriod(
  periodo: PeriodoContableBase,
  subperiodos: ChildPeriodSummary[] = []
): CloseValidationResult {
  const blockers: string[] = [];

  if (
    periodo.estado !== ESTADO_PERIODO.ABIERTO &&
    periodo.estado !== ESTADO_PERIODO.REABIERTO &&
    periodo.estado !== ESTADO_PERIODO.EN_CIERRE
  ) {
    blockers.push(
      `El período ${periodo.codigo} no puede cerrarse desde estado ${periodo.estado}.`
    );
  }

  const childBlockers = subperiodos
    .filter(
      (item) =>
        item.estado !== ESTADO_PERIODO.CERRADO &&
        item.estado !== ESTADO_PERIODO.APROBADO
    )
    .map(
      (item) =>
        `El subperíodo ${item.codigo} sigue en estado ${item.estado}.`
    );

  blockers.push(...childBlockers);

  if (blockers.length > 0) {
    return {
      ok: false,
      reason: 'El período todavía tiene dependencias abiertas.',
      blockers,
    };
  }

  return {
    ok: true,
    blockers,
  };
}

/**
 * @description Crea un payload base para persistir un período contable.
 * @param {TipoPeriodo} tipo - Tipo del período.
 * @param {Date} referencia - Fecha ancla.
 * @param {string | null | undefined} periodoPadreId - Padre opcional.
 * @returns {PeriodoContableBase} Datos base del período.
 */
export function createPeriodSeed(
  tipo: TipoPeriodo,
  referencia: Date,
  periodoPadreId?: string | null
): PeriodoContableBase {
  const { fechaInicio, fechaFin } = buildPeriodRange(tipo, referencia);

  return {
    tipo,
    codigo: buildPeriodCode(tipo, referencia),
    fechaInicio,
    fechaFin,
    estado: ESTADO_PERIODO.BORRADOR,
    periodoPadreId: periodoPadreId ?? null,
  };
}
