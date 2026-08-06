import { Decimal } from '@/generated/prisma/runtime/library';

type DecimalInput = Decimal.Value;
const MAX_COMMISSION_RATE = new Decimal('0.07');
const MAX_PAYOUT_USD = new Decimal('9999999999.99');
const MAX_EXCHANGE_RATE = new Decimal('99999999.9999');
const MAX_PAYOUT_CUP = new Decimal('999999999999.99');

interface RecurringCommissionInput {
  /** Explicit commission base for new callers; this is the license list price. */
  commissionBaseUsd?: DecimalInput;
  /** @deprecated Use commissionBaseUsd. Kept for existing direct callers. */
  amountPaidUsd?: DecimalInput;
  commissionRate: DecimalInput;
}

interface RecurringCommissionSnapshot {
  commissionBaseUsd: Decimal;
  commissionRate: Decimal;
  commissionAmountUsd: Decimal;
}

interface SalesAgentPayoutInput {
  amountUsd: DecimalInput;
  availableBalanceUsd: DecimalInput;
  exchangeRateCupPerUsd: DecimalInput;
}

interface SalesAgentPayoutSnapshot {
  amountUsd: Decimal;
  exchangeRateCupPerUsd: Decimal;
  amountCup: Decimal;
  remainingBalanceUsd: Decimal;
}

/**
 * @description Calculates recurring commission from the standard license list price.
 * @param {RecurringCommissionInput} input - Standard list-price base and applicable dynamic rate.
 * @returns {RecurringCommissionSnapshot} Immutable USD commission snapshot.
 */
export function calculateRecurringCommission(
  input: RecurringCommissionInput,
): RecurringCommissionSnapshot {
  const commissionBaseInput = input.commissionBaseUsd ?? input.amountPaidUsd;
  if (commissionBaseInput === undefined) {
    throw new RangeError('Commission base in USD is required');
  }
  const commissionBaseUsd = new Decimal(commissionBaseInput);
  const commissionRate = new Decimal(input.commissionRate);

  assertPositive(commissionBaseUsd, 'Commission base in USD must be greater than zero');
  assertPositive(commissionRate, 'Commission rate must be greater than zero');

  if (commissionRate.gt(MAX_COMMISSION_RATE)) {
    throw new RangeError('Commission rate cannot exceed 7%');
  }

  const commissionAmountUsd = commissionBaseUsd.mul(commissionRate).toDecimalPlaces(2);
  assertPositive(
    commissionAmountUsd,
    'Commission amount must be greater than zero after rounding',
  );

  return {
    commissionBaseUsd,
    commissionRate,
    commissionAmountUsd,
  };
}

/**
 * @description Validates and calculates a partial CUP payout from an available USD balance.
 * @param {SalesAgentPayoutInput} input - Requested USD, available USD, and CUP/USD rate.
 * @returns {SalesAgentPayoutSnapshot} Currency conversion and remaining-balance snapshot.
 */
export function calculateSalesAgentPayout(
  input: SalesAgentPayoutInput,
): SalesAgentPayoutSnapshot {
  const amountUsd = new Decimal(input.amountUsd);
  const availableBalanceUsd = new Decimal(input.availableBalanceUsd);
  const exchangeRateCupPerUsd = new Decimal(input.exchangeRateCupPerUsd);

  assertPositive(amountUsd, 'Payout amount in USD must be greater than zero');
  assertPositive(exchangeRateCupPerUsd, 'Exchange rate must be greater than zero');
  assertMaximum(amountUsd, MAX_PAYOUT_USD, 'Payout amount exceeds persisted decimal bounds');
  assertMaximum(
    exchangeRateCupPerUsd,
    MAX_EXCHANGE_RATE,
    'Exchange rate exceeds persisted decimal bounds',
  );

  if (amountUsd.gt(availableBalanceUsd)) {
    throw new RangeError('Payout amount cannot exceed the available balance');
  }

  const amountCup = amountUsd.mul(exchangeRateCupPerUsd).toDecimalPlaces(2);
  assertMaximum(amountCup, MAX_PAYOUT_CUP, 'CUP payout exceeds persisted decimal bounds');

  return {
    amountUsd,
    exchangeRateCupPerUsd,
    amountCup,
    remainingBalanceUsd: availableBalanceUsd.sub(amountUsd).toDecimalPlaces(2),
  };
}

/**
 * @description Ensures a monetary or rate value is strictly positive.
 * @param {Decimal} value - Decimal value to validate.
 * @param {string} message - Domain error message.
 * @returns {void}
 */
function assertPositive(value: Decimal, message: string): void {
  if (!value.gt(0)) {
    throw new RangeError(message);
  }
}

/**
 * @description Ensures a Decimal value fits its persisted upper bound.
 * @param {Decimal} value - Decimal value to validate.
 * @param {Decimal} maximum - Inclusive database-compatible maximum.
 * @param {string} message - Domain error message.
 * @returns {void}
 */
function assertMaximum(value: Decimal, maximum: Decimal, message: string): void {
  if (!value.isFinite() || value.gt(maximum)) {
    throw new RangeError(message);
  }
}
