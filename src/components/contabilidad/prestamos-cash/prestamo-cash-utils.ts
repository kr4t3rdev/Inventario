/**
 * @description Calcula el saldo total a cobrar de un préstamo cash.
 * @param {number} montoCapital - Capital otorgado.
 * @param {number | null | undefined} tasaInteres - Tasa de interés porcentual.
 * @returns {number} Monto total a cobrar.
 */
export function calcularMontoTotalACobrar(montoCapital: number, tasaInteres?: number | null): number {
  const capital = Number(montoCapital) || 0
  const tasa = Number(tasaInteres) || 0

  if (capital <= 0) return 0

  return Number((capital * (1 + tasa / 100)).toFixed(2))
}

/**
 * @description Calcula el saldo pendiente de un préstamo a partir de la deuda total y lo pagado.
 * @param {number} montoDeuda - Total a cobrar.
 * @param {number} montoPagado - Total ya pagado.
 * @returns {number} Saldo pendiente restante.
 */
export function calcularSaldoPendientePrestamo(montoDeuda: number, montoPagado: number): number {
  const deuda = Number(montoDeuda) || 0
  const pagado = Number(montoPagado) || 0
  return Math.max(0, Number((deuda - pagado).toFixed(2)))
}

/**
 * @description Normaliza el estado de un préstamo considerando el saldo real y una tolerancia de centavos.
 * @param {string} estadoActual - Estado persistido del préstamo.
 * @param {{ montoDeuda: number; montoPagado: number; estado?: string }} cuentaPorCobrar - Datos de la cuenta asociada.
 * @returns {string} Estado normalizado.
 */
export function normalizarEstadoPrestamoCash(
  estadoActual: string,
  cuentaPorCobrar: { montoDeuda: number; montoPagado: number; estado?: string }
): string {
  const saldo = calcularSaldoPendientePrestamo(cuentaPorCobrar.montoDeuda, cuentaPorCobrar.montoPagado)

  if (saldo <= 0.01) return 'PAGADO'
  if (estadoActual === 'CANCELADO') return 'CANCELADO'
  if (cuentaPorCobrar.estado === 'PAGADA') return 'PAGADO'
  return estadoActual === 'PAGADO' ? 'PAGADO' : 'ACTIVO'
}
