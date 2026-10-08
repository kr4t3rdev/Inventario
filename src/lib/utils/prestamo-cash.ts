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
 * @description Calcula el saldo total a cobrar de un préstamo cash.
 * @param {DecimalInput} montoCapital - Capital otorgado.
 * @param {DecimalInput | null | undefined} tasaInteres - Tasa de interés porcentual.
 * @returns {Prisma.Decimal} Monto total a cobrar (aritmética decimal exacta, 2 decimales).
 */
export function calcularMontoTotalACobrar(montoCapital: DecimalInput, tasaInteres?: DecimalInput | null): Prisma.Decimal {
  const capital = toDecimalOrZero(montoCapital)
  const tasa = toDecimalOrZero(tasaInteres)

  if (capital.lte(0)) return new Prisma.Decimal(0)

  return capital
    .mul(new Prisma.Decimal(1).add(tasa.div(100)))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

/**
 * @description Calcula el saldo pendiente de un préstamo a partir de la deuda total y lo pagado.
 * @param {DecimalInput} montoDeuda - Total a cobrar.
 * @param {DecimalInput} montoPagado - Total ya pagado.
 * @returns {Prisma.Decimal} Saldo pendiente restante (nunca negativo, 2 decimales).
 */
export function calcularSaldoPendientePrestamo(montoDeuda: DecimalInput, montoPagado: DecimalInput): Prisma.Decimal {
  const deuda = toDecimalOrZero(montoDeuda)
  const pagado = toDecimalOrZero(montoPagado)
  const saldo = deuda.sub(pagado).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
  return saldo.gt(0) ? saldo : new Prisma.Decimal(0)
}

/**
 * @description Normaliza el estado de un préstamo considerando el saldo real y una tolerancia de centavos.
 * @param {string} estadoActual - Estado persistido del préstamo.
 * @param {{ montoDeuda: DecimalInput; montoPagado: DecimalInput; estado?: string }} cuentaPorCobrar - Datos de la cuenta asociada.
 * @returns {string} Estado normalizado.
 */
export function normalizarEstadoPrestamoCash(
  estadoActual: string,
  cuentaPorCobrar: { montoDeuda: DecimalInput; montoPagado: DecimalInput; estado?: string }
): string {
  const saldo = calcularSaldoPendientePrestamo(cuentaPorCobrar.montoDeuda, cuentaPorCobrar.montoPagado)

  if (saldo.lte('0.01')) return 'PAGADO'
  if (estadoActual === 'CANCELADO') return 'CANCELADO'
  if (cuentaPorCobrar.estado === 'PAGADA') return 'PAGADO'
  return estadoActual === 'PAGADO' ? 'PAGADO' : 'ACTIVO'
}
