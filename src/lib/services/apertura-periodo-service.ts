import { buildPeriodCode, buildPeriodRange, ESTADO_PERIODO, TIPO_PERIODO } from '@/lib/services/periodo-contable-service';

export interface OpeningBalanceBreakdown {
  saldoCajaInicial: number;
  saldoBancoInicial: number;
  saldoCuentasCobrarInicial: number;
  saldoCuentasPagarInicial: number;
  saldoInventarioInicial: number;
  saldoCapitalInicial: number;
  saldoResultadoAcumInicial: number;
}

export interface OpeningSeed extends OpeningBalanceBreakdown {
  codigoPeriodo: string;
  tipoPeriodo: 'DIARIO' | 'MENSUAL' | 'ANUAL';
  fechaInicio: Date;
  fechaFin: Date;
  estado: 'BORRADOR' | 'ABIERTO' | 'EN_CIERRE' | 'CERRADO' | 'APROBADO' | 'REABIERTO';
  aperturaAutomatica: boolean;
  origenPeriodoId?: string | null;
  detalleJson: Record<string, unknown>;
}

export interface PreviousPeriodSnapshotLike {
  periodoId: string;
  codigo: string;
  resumen?: {
    saldoCajaFinal?: number;
    saldoBancoFinal?: number;
    saldoCuentasCobrarFinal?: number;
    saldoCuentasPagarFinal?: number;
    saldoInventarioFinal?: number;
    saldoCapitalFinal?: number;
    saldoResultadoAcumFinal?: number;
  } | null;
}

export interface LiveBalancesSource {
  caja?: number;
  bancos?: number;
  cuentasPorCobrar?: number;
  cuentasPorPagar?: number;
  inventario?: number;
  capital?: number;
  resultadosAcumulados?: number;
}

/**
 * @description Normaliza saldos numéricos para la apertura, tolerando `undefined`, `null` y strings no numéricos.
 * @param {unknown} value - Valor a convertir.
 * @returns {number} Número seguro para el balance inicial.
 */
export function normalizeOpeningAmount(value: unknown): number {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

/**
 * @description Construye el arrastre de saldos usando snapshot previo o, en su defecto, balances vivos.
 * @param {PreviousPeriodSnapshotLike | null | undefined} previousPeriod - Snapshot previo del período anterior.
 * @param {LiveBalancesSource | null | undefined} liveBalances - Saldos actuales del sistema como fallback.
 * @returns {OpeningBalanceBreakdown} Saldos iniciales listos para persistirse.
 */
export function deriveOpeningBalances(
  previousPeriod?: PreviousPeriodSnapshotLike | null,
  liveBalances?: LiveBalancesSource | null
): OpeningBalanceBreakdown {
  const resumen = previousPeriod?.resumen;

  return {
    saldoCajaInicial: normalizeOpeningAmount(
      resumen?.saldoCajaFinal ?? liveBalances?.caja
    ),
    saldoBancoInicial: normalizeOpeningAmount(
      resumen?.saldoBancoFinal ?? liveBalances?.bancos
    ),
    saldoCuentasCobrarInicial: normalizeOpeningAmount(
      resumen?.saldoCuentasCobrarFinal ?? liveBalances?.cuentasPorCobrar
    ),
    saldoCuentasPagarInicial: normalizeOpeningAmount(
      resumen?.saldoCuentasPagarFinal ?? liveBalances?.cuentasPorPagar
    ),
    saldoInventarioInicial: normalizeOpeningAmount(
      resumen?.saldoInventarioFinal ?? liveBalances?.inventario
    ),
    saldoCapitalInicial: normalizeOpeningAmount(
      resumen?.saldoCapitalFinal ?? liveBalances?.capital
    ),
    saldoResultadoAcumInicial: normalizeOpeningAmount(
      resumen?.saldoResultadoAcumFinal ?? liveBalances?.resultadosAcumulados
    ),
  };
}

/**
 * @description Genera la semilla inicial para apertura diaria/mensual/anual.
 * @param {'DIARIO' | 'MENSUAL' | 'ANUAL'} tipoPeriodo - Tipo de período a abrir.
 * @param {Date} referencia - Fecha ancla del período.
 * @param {PreviousPeriodSnapshotLike | null | undefined} previousPeriod - Período anterior ya cerrado.
 * @param {LiveBalancesSource | null | undefined} liveBalances - Saldos vivos del sistema.
 * @returns {OpeningSeed} Payload inicial para crear período + apertura.
 */
export function createOpeningSeed(
  tipoPeriodo: 'DIARIO' | 'MENSUAL' | 'ANUAL',
  referencia: Date,
  previousPeriod?: PreviousPeriodSnapshotLike | null,
  liveBalances?: LiveBalancesSource | null
): OpeningSeed {
  const { fechaInicio, fechaFin } = buildPeriodRange(tipoPeriodo, referencia);
  const balances = deriveOpeningBalances(previousPeriod, liveBalances);

  return {
    codigoPeriodo: buildPeriodCode(tipoPeriodo, referencia),
    tipoPeriodo,
    fechaInicio,
    fechaFin,
    estado: ESTADO_PERIODO.ABIERTO,
    aperturaAutomatica: true,
    origenPeriodoId: previousPeriod?.periodoId ?? null,
    ...balances,
    detalleJson: {
      origen: previousPeriod
        ? {
            periodoId: previousPeriod.periodoId,
            codigo: previousPeriod.codigo,
            estrategia: 'ARRASTRE_DESDE_SNAPSHOT',
          }
        : {
            estrategia: 'SALDOS_VIVOS',
          },
    },
  };
}

/**
 * @description Indica si un período diario puede abrirse automáticamente desde el día anterior.
 * @param {PreviousPeriodSnapshotLike | null | undefined} previousPeriod - Período previo conocido.
 * @returns {boolean} Verdadero si hay base suficiente para apertura automática confiable.
 */
export function canAutoOpenDailyPeriod(
  previousPeriod?: PreviousPeriodSnapshotLike | null
): boolean {
  return Boolean(previousPeriod?.periodoId && previousPeriod?.resumen);
}

export const APERTURA_TIPOS_SOPORTADOS = [
  TIPO_PERIODO.DIARIO,
  TIPO_PERIODO.MENSUAL,
  TIPO_PERIODO.ANUAL,
] as const;
