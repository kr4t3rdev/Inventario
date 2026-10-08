import { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';

interface AccountingAccountMovementInput {
  tenderAmount: Prisma.Decimal | number | string;
  tenderCurrency: string;
  functionalAmount: Prisma.Decimal | number | string;
  functionalCurrency: string;
  accountCurrency: string;
}

interface AccountingAccountMovement {
  amount: Prisma.Decimal;
  currency: string;
}

/**
 * @description Resuelve el delta de saldo en la moneda propia de una cuenta bancaria.
 * @param {AccountingAccountMovementInput} input - Tender, valoración funcional y cuenta.
 * @returns {AccountingAccountMovement} Importe y moneda que deben persistirse en tesorería.
 */
export function resolveAccountingAccountMovement(
  input: AccountingAccountMovementInput,
): AccountingAccountMovement {
  const tenderCurrency = input.tenderCurrency.trim().toUpperCase();
  const functionalCurrency = input.functionalCurrency.trim().toUpperCase();
  const accountCurrency = input.accountCurrency.trim().toUpperCase();
  const tenderAmount = new Prisma.Decimal(input.tenderAmount);
  const functionalAmount = new Prisma.Decimal(input.functionalAmount);

  if (!tenderCurrency || !functionalCurrency || !accountCurrency ||
    !tenderAmount.isFinite() || !tenderAmount.gt(0) ||
    !functionalAmount.isFinite() || !functionalAmount.gt(0)) {
    throw new ActionError('Valoración de movimiento bancario inválida', 'FX_INSUFICIENTE');
  }

  if (accountCurrency === tenderCurrency) {
    return { amount: tenderAmount, currency: accountCurrency };
  }

  if (accountCurrency === functionalCurrency) {
    return { amount: functionalAmount, currency: accountCurrency };
  }

  throw new ActionError(
    'La moneda de la cuenta no coincide con el tender ni con la moneda funcional',
    'FX_INSUFICIENTE',
  );
}
