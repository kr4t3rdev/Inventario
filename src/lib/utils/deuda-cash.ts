/**
 * @description Calcula el total de la deuda sumando interés al capital.
 * @param {number} montoCapital - Capital base.
 * @param {number | null | undefined} tasaInteres - Tasa porcentual.
 * @returns {number} Total adeudado con interés.
 */
export function calcularTotalDeudaConInteres(montoCapital: number, tasaInteres?: number | null): number {
  const capital = Number(montoCapital) || 0
  const tasa = Number(tasaInteres) || 0

  if (capital <= 0) return 0

  return Number((capital * (1 + tasa / 100)).toFixed(2))
}

/**
 * @description Calcula el saldo pendiente de una deuda cash.
 * @param {number} montoDeuda - Total adeudado.
 * @param {number} montoPagado - Total ya pagado.
 * @returns {number} Saldo pendiente.
 */
export function calcularSaldoPendienteDeuda(montoDeuda: number, montoPagado: number): number {
  const deuda = Number(montoDeuda) || 0
  const pagado = Number(montoPagado) || 0
  return Math.max(0, Number((deuda - pagado).toFixed(2)))
}

/**
 * @description Normaliza el estado de una deuda cash con base en saldo y tolerancia de centavos.
 * @param {string} estadoActual - Estado persistido.
 * @param {{ montoDeuda: number; montoPagado: number; estado?: string }} cuentaPorPagar - Cuenta asociada.
 * @returns {string} Estado normalizado.
 */
export function normalizarEstadoDeudaCash(
  estadoActual: string,
  cuentaPorPagar: { montoDeuda: number; montoPagado: number; estado?: string }
): string {
  const saldo = calcularSaldoPendienteDeuda(cuentaPorPagar.montoDeuda, cuentaPorPagar.montoPagado)

  if (saldo <= 0.01) return 'PAGADO'
  if (estadoActual === 'CANCELADO') return 'CANCELADO'
  if (cuentaPorPagar.estado === 'PAGADA') return 'PAGADO'
  return estadoActual === 'PAGADO' ? 'PAGADO' : 'ACTIVO'
}
