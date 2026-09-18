import type { FinancialData } from './types';

const FALLBACK_CURRENCY = 'CUP';

/**
 * @description Devuelve la moneda funcional segura para Intl.NumberFormat.
 * @param {string | undefined} currency - Código persistido o recibido del reporte.
 * @returns {string} Código ISO de tres letras.
 */
export function getFunctionalCurrency(currency?: string): string {
  return /^[A-Z]{3}$/.test(currency?.trim().toUpperCase() ?? '')
    ? currency!.trim().toUpperCase()
    : FALLBACK_CURRENCY;
}

/**
 * @description Formatea un importe con la moneda funcional del reporte.
 * @param {number | null | undefined} amount - Importe a presentar.
 * @param {string} currency - Código de moneda.
 * @returns {string} Importe localizado.
 */
export function formatMoney(amount: number | null | undefined, currency = FALLBACK_CURRENCY): string {
  return new Intl.NumberFormat('es-CU', {
    style: 'currency',
    currency: getFunctionalCurrency(currency),
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? Number(amount) : 0);
}

/**
 * @description Presenta una fecha contable en formato legible y estable.
 * @param {string | null | undefined} value - Fecha ISO del servidor.
 * @param {boolean} includeTime - Indica si se debe incluir la hora.
 * @returns {string} Fecha localizada o texto de ausencia.
 */
export function formatAccountingDate(value: string | null | undefined, includeTime = false): string {
  if (!value) return 'Sin fecha disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return date.toLocaleString('es-CU', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' } : {}),
    timeZone: 'America/Havana',
  });
}

/**
 * @description Detecta un reporte sin fuentes ni movimiento para evitar mostrar ceros como balance válido.
 * @param {FinancialData} data - Reporte financiero cargado.
 * @returns {boolean} Verdadero si no existen importes ni líneas mensuales.
 */
export function isEmptyFinancialReport(data: FinancialData): boolean {
  const balanceTotals = [
    data.balance.activos.total,
    data.balance.pasivos.total,
    data.balance.patrimonio.total,
  ];
  const resultTotals = [
    data.estadoResultados.anual.totalIngresos,
    data.estadoResultados.anual.totalGastos,
    data.estadoResultados.anual.utilidadNeta,
  ];
  const hasIncidents = (data.balance.incidencias?.length ?? 0) > 0 ||
    (data.estadoResultados.incidencias?.length ?? 0) > 0;

  return !hasIncidents &&
    data.estadoResultados.mensual.length === 0 &&
    [...balanceTotals, ...resultTotals].every((value) => Number(value) === 0);
}
