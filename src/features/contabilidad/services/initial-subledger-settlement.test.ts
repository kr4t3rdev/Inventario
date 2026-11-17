import { describe, expect, it } from 'vitest';
import { calculateInitialSubledgerSettlement } from './initial-subledger-settlement';

describe('calculateInitialSubledgerSettlement', () => {
  const base = {
    role: 'receivable' as const,
    balanceOriginal: '100.0000',
    balanceFunctional: '100.0000',
    obligationCurrency: 'CUP',
    paymentCurrency: 'CUP',
    functionalCurrency: 'CUP',
  };

  it('applies a partial receipt and keeps original and functional residuals exact', () => {
    expect(calculateInitialSubledgerSettlement({
      ...base,
      paymentOriginal: '33.3333',
      paymentFunctional: '33.5000',
    })).toEqual({
      appliedOriginal: '33.3333',
      appliedBookFunctional: '33.3333',
      paymentFunctional: '33.5000',
      remainingOriginal: '66.6667',
      remainingBookFunctional: '66.6667',
      cashVarianceFunctional: '0.1667',
    });
  });

  it('consumes the exact residual functional value on a final settlement', () => {
    expect(calculateInitialSubledgerSettlement({
      ...base,
      balanceOriginal: '0.0003',
      balanceFunctional: '0.0002',
      paymentOriginal: '0.0003',
      paymentFunctional: '0.0002',
    })).toEqual({
      appliedOriginal: '0.0003',
      appliedBookFunctional: '0.0002',
      paymentFunctional: '0.0002',
      remainingOriginal: '0.0000',
      remainingBookFunctional: '0.0000',
      cashVarianceFunctional: '0.0000',
    });
  });

  it('keeps cash variance direction-neutral for accounts payable', () => {
    expect(calculateInitialSubledgerSettlement({
      ...base,
      role: 'payable',
      balanceOriginal: '50.0000',
      balanceFunctional: '50.0000',
      paymentOriginal: '50.0000',
      paymentFunctional: '52.0000',
    }).cashVarianceFunctional).toBe('2.0000');
  });

  it('rejects an amount greater than the open balance', () => {
    expect(() => calculateInitialSubledgerSettlement({
      ...base,
      paymentOriginal: '100.0001',
      paymentFunctional: '100.0001',
    })).toThrow('INITIAL_SETTLEMENT_EXCEEDS_BALANCE');
  });

  it('rejects mismatched original and payment currencies', () => {
    expect(() => calculateInitialSubledgerSettlement({
      ...base,
      paymentCurrency: 'USD',
      paymentOriginal: '1.0000',
      paymentFunctional: '1.0000',
    })).toThrow('INITIAL_SETTLEMENT_CURRENCY_MISMATCH');
  });

  it('requires explicit positive functional amounts and four-decimal precision', () => {
    expect(() => calculateInitialSubledgerSettlement({
      ...base,
      paymentOriginal: '1.12345',
      paymentFunctional: '1.1235',
    })).toThrow('INITIAL_SETTLEMENT_AMOUNT_INVALID');
    expect(() => calculateInitialSubledgerSettlement({
      ...base,
      paymentOriginal: '1.0000',
      paymentFunctional: '0',
    })).toThrow('INITIAL_SETTLEMENT_AMOUNT_INVALID');
  });
});
