import { describe, expect, it } from 'vitest';
import { resolveAccountingAccountMovement } from './accounting-account-movement-valuation';

describe('resolveAccountingAccountMovement', () => {
  it('conserva el importe nominal cuando la cuenta usa la moneda del tender', () => {
    const movement = resolveAccountingAccountMovement({
      tenderAmount: 40,
      tenderCurrency: 'USD',
      functionalAmount: 1000,
      functionalCurrency: 'CUP',
      accountCurrency: 'USD',
    });
    expect(movement.amount.toString()).toBe('40');
    expect(movement.currency).toBe('USD');
  });

  it('usa el importe funcional cuando la cuenta está en la moneda funcional', () => {
    const movement = resolveAccountingAccountMovement({
      tenderAmount: 40,
      tenderCurrency: 'USD',
      functionalAmount: 1000,
      functionalCurrency: 'CUP',
      accountCurrency: 'CUP',
    });
    expect(movement.amount.toString()).toBe('1000');
    expect(movement.currency).toBe('CUP');
  });

  it('rechaza una cuenta en una tercera moneda sin cotización cruzada', () => {
    expect(() => resolveAccountingAccountMovement({
      tenderAmount: 40,
      tenderCurrency: 'USD',
      functionalAmount: 1000,
      functionalCurrency: 'CUP',
      accountCurrency: 'EUR',
    })).toThrowError(expect.objectContaining({
      code: 'FX_INSUFICIENTE',
    }));
  });

  it('usa la moneda funcional configurada por tenant, no una constante CUP', () => {
    const movement = resolveAccountingAccountMovement({
      tenderAmount: 1000,
      tenderCurrency: 'CUP',
      functionalAmount: 40,
      functionalCurrency: 'USD',
      accountCurrency: 'USD',
    });
    expect(movement.amount.toString()).toBe('40');
    expect(movement.currency).toBe('USD');
  });
});
