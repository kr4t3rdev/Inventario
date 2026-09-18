import { describe, expect, it } from 'vitest';

import {
  calculateRecurringCommission,
  calculateSalesAgentPayout,
} from '../commission-service';

describe('calculateRecurringCommission', () => {
  it('calculates recurring commission from the standard list-price base', () => {
    const result = calculateRecurringCommission({
      commissionBaseUsd: '80.50',
      commissionRate: '0.05',
    });

    expect(result.commissionBaseUsd.toString()).toBe('80.5');
    expect(result.commissionRate.toString()).toBe('0.05');
    expect(result.commissionAmountUsd.toFixed(2)).toBe('4.03');
  });

  it.each(['0', '-1'])(
    'rejects a non-positive commission base: %s',
    (amountPaidUsd) => {
      expect(() =>
        calculateRecurringCommission({ amountPaidUsd, commissionRate: '0.03' }),
      ).toThrow('Commission base in USD must be greater than zero');
    },
  );

  it.each(['0', '-0.01'])(
    'rejects a non-positive commission rate: %s',
    (commissionRate) => {
      expect(() =>
        calculateRecurringCommission({ amountPaidUsd: '100', commissionRate }),
      ).toThrow('Commission rate must be greater than zero');
    },
  );

  it('rejects a commission rate above the maximum sales-agent tier', () => {
    expect(() =>
      calculateRecurringCommission({
        amountPaidUsd: '100',
        commissionRate: '0.11',
      }),
    ).toThrow('Commission rate cannot exceed 10%');
  });

  it('rejects an amount whose commission rounds to zero', () => {
    expect(() =>
      calculateRecurringCommission({
        amountPaidUsd: '0.01',
        commissionRate: '0.03',
      }),
    ).toThrow('Commission amount must be greater than zero after rounding');
  });
});

describe('calculateSalesAgentPayout', () => {
  it('supports a partial payout and snapshots the CUP conversion', () => {
    const result = calculateSalesAgentPayout({
      amountUsd: '25.50',
      availableBalanceUsd: '100',
      exchangeRateCupPerUsd: '325',
    });

    expect(result.amountUsd.toString()).toBe('25.5');
    expect(result.exchangeRateCupPerUsd.toString()).toBe('325');
    expect(result.amountCup.toFixed(2)).toBe('8287.50');
    expect(result.remainingBalanceUsd.toFixed(2)).toBe('74.50');
  });

  it.each(['0', '-1'])(
    'rejects a non-positive payout amount: %s',
    (amountUsd) => {
      expect(() =>
        calculateSalesAgentPayout({
          amountUsd,
          availableBalanceUsd: '100',
          exchangeRateCupPerUsd: '325',
        }),
      ).toThrow('Payout amount in USD must be greater than zero');
    },
  );

  it.each(['0', '-1'])(
    'rejects a non-positive exchange rate: %s',
    (exchangeRateCupPerUsd) => {
      expect(() =>
        calculateSalesAgentPayout({
          amountUsd: '10',
          availableBalanceUsd: '100',
          exchangeRateCupPerUsd,
        }),
      ).toThrow('Exchange rate must be greater than zero');
    },
  );

  it('rejects a payout above the available balance', () => {
    expect(() =>
      calculateSalesAgentPayout({
        amountUsd: '100.01',
        availableBalanceUsd: '100',
        exchangeRateCupPerUsd: '325',
      }),
    ).toThrow('Payout amount cannot exceed the available balance');
  });

  it.each([
    {
      amountUsd: '10000000000',
      availableBalanceUsd: '10000000000',
      exchangeRateCupPerUsd: '1',
      message: 'Payout amount exceeds persisted decimal bounds',
    },
    {
      amountUsd: '1',
      availableBalanceUsd: '1',
      exchangeRateCupPerUsd: '100000000',
      message: 'Exchange rate exceeds persisted decimal bounds',
    },
    {
      amountUsd: '9999999999.99',
      availableBalanceUsd: '9999999999.99',
      exchangeRateCupPerUsd: '101',
      message: 'CUP payout exceeds persisted decimal bounds',
    },
  ])('revalidates database decimal bounds with Decimal: $message', (input) => {
    expect(() => calculateSalesAgentPayout(input)).toThrow(input.message);
  });
});
