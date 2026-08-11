export interface GastosPendientesFiltersInput {
  fechaInicio?: string;
  fechaFin?: string;
  tipoGasto?: string;
  soloNoReconciliados?: boolean;
  page: number;
  limit: number;
}

interface ResumenPorMoneda {
  moneda: string;
  flujoNeto?: number | null;
}

/**
 * @description Construye los filtros de gastos pendientes respetando todo el período seleccionado.
 * @param {GastosPendientesFiltersInput} input - Período y filtros de la vista.
 * @returns {Record<string, unknown>} Filtros compatibles con la acción de gastos pendientes.
 */
export function buildGastosPendientesFilters({
  fechaInicio,
  fechaFin,
  tipoGasto,
  soloNoReconciliados,
  page,
  limit,
}: GastosPendientesFiltersInput): {
  fechaDesde?: string;
  fechaHasta?: string;
  tipoGasto?: string;
  soloNoReconciliados?: boolean;
  page: number;
  limit: number;
} {
  return {
    fechaDesde: fechaInicio,
    fechaHasta: fechaFin,
    tipoGasto,
    soloNoReconciliados,
    page,
    limit,
  };
}

/**
 * @description Obtiene el flujo neto de la moneda principal del resumen financiero.
 * @param {ResumenPorMoneda[]} resumenPorMoneda - Resumen agrupado por moneda.
 * @param {string} monedaPrincipal - Código de la moneda principal.
 * @returns {number} Flujo neto de la moneda principal o cero si no existe.
 */
export function getSaldoNetoTotal(
  resumenPorMoneda: ResumenPorMoneda[] | undefined,
  monedaPrincipal: string,
): number {
  return resumenPorMoneda?.find((resumen) => resumen.moneda === monedaPrincipal)?.flujoNeto ?? 0;
}
