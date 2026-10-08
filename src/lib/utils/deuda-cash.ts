import { Prisma } from '@/generated/prisma';

type DecimalInput = number | string | Prisma.Decimal;

function toDecimalOrZero(value: DecimalInput | null | undefined): Prisma.Decimal {
  try {
    const d = new Prisma.Decimal(value as DecimalInput);
    return d.isFinite() ? d : new Prisma.Decimal(0);
  } catch {
    return new Prisma.Decimal(0);
  }
}

/**
 * @description Calcula el total de la deuda sumando interés al capital.
 * @param {DecimalInput} montoCapital - Capital base.
 * @param {DecimalInput | null | undefined} tasaInteres - Tasa porcentual.
 * @returns {Prisma.Decimal} Total adeudado con interés (aritmética decimal exacta, 2 decimales).
 */
export function calcularTotalDeudaConInteres(montoCapital: DecimalInput, tasaInteres?: DecimalInput | null): Prisma.Decimal {
  const capital = toDecimalOrZero(montoCapital)
  const tasa = toDecimalOrZero(tasaInteres)

  if (capital.lte(0)) return new Prisma.Decimal(0)

  return capital
    .mul(new Prisma.Decimal(1).add(tasa.div(100)))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

/**
 * @description Calcula el saldo pendiente de una deuda cash.
 * @param {DecimalInput} montoDeuda - Total adeudado.
 * @param {DecimalInput} montoPagado - Total ya pagado.
 * @returns {Prisma.Decimal} Saldo pendiente (nunca negativo, 2 decimales).
 */
export function calcularSaldoPendienteDeuda(montoDeuda: DecimalInput, montoPagado: DecimalInput): Prisma.Decimal {
  const deuda = toDecimalOrZero(montoDeuda)
  const pagado = toDecimalOrZero(montoPagado)
  const saldo = deuda.sub(pagado).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
  return saldo.gt(0) ? saldo : new Prisma.Decimal(0)
}

/**
 * @description Normaliza el estado de una deuda cash con base en saldo y tolerancia de centavos.
 * @param {string} estadoActual - Estado persistido.
 * @param {{ montoDeuda: DecimalInput; montoPagado: DecimalInput; estado?: string }} cuentaPorPagar - Cuenta asociada.
 * @returns {string} Estado normalizado.
 */
export function normalizarEstadoDeudaCash(
  estadoActual: string,
  cuentaPorPagar: { montoDeuda: DecimalInput; montoPagado: DecimalInput; estado?: string }
): string {
  const saldo = calcularSaldoPendienteDeuda(cuentaPorPagar.montoDeuda, cuentaPorPagar.montoPagado)

  if (saldo.lte('0.01')) return 'PAGADO'
  if (estadoActual === 'CANCELADO') return 'CANCELADO'
  if (cuentaPorPagar.estado === 'PAGADA') return 'PAGADO'
  return estadoActual === 'PAGADO' ? 'PAGADO' : 'ACTIVO'
}
