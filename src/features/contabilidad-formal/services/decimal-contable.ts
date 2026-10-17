import { Prisma } from '@/generated/prisma';

/**
 * @description Valida un importe funcional sin redondear ni perder precisión.
 * @param {Prisma.Decimal | string} valor - Importe decimal recibido del evento.
 * @returns {Prisma.Decimal} Importe representable exactamente a cuatro decimales.
 */
export function decimalFuncional(valor: Prisma.Decimal | string): Prisma.Decimal {
  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(valor);
  } catch {
    throw new Error('IMPORTE_CONTABLE_INVALIDO');
  }
  if (!decimal.isFinite()) throw new Error('IMPORTE_CONTABLE_INVALIDO');
  if (!decimal.mul(10000).isInteger()) throw new Error('PRECISION_FUNCIONAL_INVALIDA');
  return decimal;
}

/**
 * @description Serializa el valor validado sin ceros finales ni notación exponencial.
 * @param {Prisma.Decimal | string} valor - Importe funcional exacto.
 * @returns {string} Representación decimal canónica.
 */
export function serializarDecimalContable(valor: Prisma.Decimal | string): string {
  return decimalFuncional(valor).toFixed();
}
