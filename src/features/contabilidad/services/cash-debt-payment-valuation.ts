import { ActionError } from '@/lib/server-actions';
import { Prisma } from '@/generated/prisma';

type DecimalInput = number | string | Prisma.Decimal;

interface CashDebtCurrencyAmountsInput {
  monedaObligacion: string;
  monedaFondos: string;
  monedaCuenta: string;
  montoFondos: DecimalInput;
  montoFuncional: DecimalInput;
  functionalCurrency?: string;
}

interface CashDebtCurrencyAmounts {
  montoObligacion: Prisma.Decimal;
  montoCuenta: Prisma.Decimal;
}

/**
 * @description Resuelve el principal de una deuda y el importe nominal recibido/movido en cuenta.
 * @param {CashDebtCurrencyAmountsInput} input - Monedas e importes persistibles.
 * @returns {CashDebtCurrencyAmounts} Importe nominal de obligación y movimiento de banco.
 */
export function resolveCashDebtCurrencyAmounts(
  input: CashDebtCurrencyAmountsInput,
): CashDebtCurrencyAmounts {
  const monedaObligacion = input.monedaObligacion.trim().toUpperCase();
  const monedaFondos = input.monedaFondos.trim().toUpperCase();
  const monedaCuenta = input.monedaCuenta.trim().toUpperCase();
  const monedaFuncional = input.functionalCurrency?.trim().toUpperCase() || 'CUP';

  let montoFondos: Prisma.Decimal;
  let montoFuncional: Prisma.Decimal;
  try {
    montoFondos = new Prisma.Decimal(input.montoFondos);
    montoFuncional = new Prisma.Decimal(input.montoFuncional);
  } catch {
    throw new ActionError('Valoración del pago de deuda inválida', 'FX_INSUFICIENTE');
  }
  if (!monedaObligacion || !monedaFondos || !monedaCuenta ||
    !montoFondos.isFinite() || montoFondos.lte(0) ||
    !montoFuncional.isFinite() || montoFuncional.lte(0)) {
    throw new ActionError('Valoración del pago de deuda inválida', 'FX_INSUFICIENTE');
  }

  if (
    monedaObligacion !== monedaFondos &&
    monedaObligacion !== monedaFuncional
  ) {
    throw new ActionError(
      'La moneda de los fondos debe coincidir con la obligación o la moneda funcional',
      'FX_INSUFICIENTE',
    );
  }

  if (monedaCuenta !== monedaFondos && monedaCuenta !== monedaFuncional) {
    throw new ActionError(
      `No se puede mover fondos a una cuenta distinta al tender o ${monedaFuncional} sin una cotización específica`,
      'FX_INSUFICIENTE',
    );
  }

  return {
    montoObligacion: monedaObligacion === monedaFondos
      ? montoFondos
      : montoFuncional,
    montoCuenta: monedaCuenta === monedaFondos
      ? montoFondos
      : montoFuncional,
  };
}
