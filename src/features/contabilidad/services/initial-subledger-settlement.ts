import { Prisma } from '@/generated/prisma';

export interface InitialSubledgerSettlementInput {
  role: 'receivable' | 'payable';
  balanceOriginal: string;
  balanceFunctional: string;
  obligationCurrency: string;
  paymentCurrency: string;
  functionalCurrency: string;
  paymentOriginal: string;
  paymentFunctional: string;
}

export interface InitialSubledgerSettlementResult {
  appliedOriginal: string;
  appliedBookFunctional: string;
  paymentFunctional: string;
  remainingOriginal: string;
  remainingBookFunctional: string;
  cashVarianceFunctional: string;
}

const SCALE = 4;
const Decimal = Prisma.Decimal.clone({ precision: 80 });
const ZERO = new Decimal(0);

/**
 * @description Parses a positive money amount with at most four decimal places.
 * @param value - User or persisted monetary value.
 * @returns Exact decimal amount.
 */
function parseAmount(value: string): Prisma.Decimal {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,4})?$/.test(value)) {
    throw new Error('INITIAL_SETTLEMENT_AMOUNT_INVALID');
  }

  const amount = new Decimal(value);
  if (!amount.isFinite() || amount.lte(ZERO)) {
    throw new Error('INITIAL_SETTLEMENT_AMOUNT_INVALID');
  }
  return amount;
}

/**
 * @description Formats a monetary amount using the ledger's four decimal places.
 * @param value - Exact decimal amount.
 * @returns Fixed-scale amount string.
 */
function formatAmount(value: Prisma.Decimal): string {
  return value.toFixed(SCALE);
}

/**
 * @description Calculates an external receivable or payable settlement without writing records.
 * @param input - Original balance and explicit settlement amounts in both currencies.
 * @returns Applied values, remaining balance, and functional-currency cash variance.
 */
export function calculateInitialSubledgerSettlement(
  input: InitialSubledgerSettlementInput,
): InitialSubledgerSettlementResult {
  if (input.role !== 'receivable' && input.role !== 'payable') {
    throw new Error('INITIAL_SETTLEMENT_ROLE_INVALID');
  }
  if (
    !input.obligationCurrency.trim() ||
    !input.paymentCurrency.trim() ||
    !input.functionalCurrency.trim() ||
    input.obligationCurrency.trim().toUpperCase() !==
      input.paymentCurrency.trim().toUpperCase()
  ) {
    throw new Error('INITIAL_SETTLEMENT_CURRENCY_MISMATCH');
  }

  const balanceOriginal = parseAmount(input.balanceOriginal);
  const balanceFunctional = parseAmount(input.balanceFunctional);
  const paymentOriginal = parseAmount(input.paymentOriginal);
  const paymentFunctional = parseAmount(input.paymentFunctional);

  if (paymentOriginal.gt(balanceOriginal)) {
    throw new Error('INITIAL_SETTLEMENT_EXCEEDS_BALANCE');
  }

  const isFinalSettlement = paymentOriginal.eq(balanceOriginal);
  const appliedBookFunctional = isFinalSettlement
    ? balanceFunctional
    : paymentOriginal
        .dividedBy(balanceOriginal)
        .times(balanceFunctional)
        .toDecimalPlaces(SCALE, Decimal.ROUND_HALF_UP);

  const remainingOriginal = balanceOriginal.minus(paymentOriginal);
  const remainingBookFunctional = balanceFunctional.minus(appliedBookFunctional);
  const cashVarianceFunctional = paymentFunctional.minus(appliedBookFunctional);

  return {
    appliedOriginal: formatAmount(paymentOriginal),
    appliedBookFunctional: formatAmount(appliedBookFunctional),
    paymentFunctional: formatAmount(paymentFunctional),
    remainingOriginal: formatAmount(remainingOriginal),
    remainingBookFunctional: formatAmount(remainingBookFunctional),
    cashVarianceFunctional: formatAmount(cashVarianceFunctional),
  };
}
