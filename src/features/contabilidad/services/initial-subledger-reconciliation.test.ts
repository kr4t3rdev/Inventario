import { describe, expect, it } from 'vitest';
import { reconcileInitialSubledgers } from './initial-subledger-reconciliation';

describe('reconcileInitialSubledgers', () => {
  it('sums receivables as debits and payables as credits exactly by account and currency', () => {
    expect(reconcileInitialSubledgers([
      { tipo: 'CXC', cuentaContableId: 'cxc', moneda: 'CUP', saldo: '0.1' },
      { tipo: 'CXC', cuentaContableId: 'cxc', moneda: 'CUP', saldo: '0.2' },
      { tipo: 'CXP', cuentaContableId: 'cxp', moneda: 'USD', saldo: '23.4567' },
    ], [
      { tipo: 'CXC', cuentaContableId: 'cxc', moneda: 'CUP', debito: '0.3', credito: '0' },
      { tipo: 'CXP', cuentaContableId: 'cxp', moneda: 'USD', debito: '0', credito: '23.4567' },
    ])).toEqual({ conciliado: true });
  });

  it('rejects differences even when cross-currency totals are equal', () => {
    expect(() => reconcileInitialSubledgers([
      { tipo: 'CXC', cuentaContableId: 'cxc', moneda: 'CUP', saldo: '100' },
    ], [{ tipo: 'CXC', cuentaContableId: 'cxc', moneda: 'USD', debito: '100', credito: '0' }]))
      .toThrow('no coinciden');
  });

  it('rejects missing and extra ledger amounts for each account', () => {
    expect(() => reconcileInitialSubledgers([
      { tipo: 'CXP', cuentaContableId: 'a', moneda: 'CUP', saldo: '10' },
    ], [{ tipo: 'CXP', cuentaContableId: 'b', moneda: 'CUP', debito: '0', credito: '10' }]))
      .toThrow('no coinciden');
  });

  it('rejects entries on the wrong side without netting them', () => {
    expect(() => reconcileInitialSubledgers([], [
      { tipo: 'CXC', cuentaContableId: 'cxc', moneda: 'CUP', debito: '5', credito: '5' },
    ])).toThrow('débito');
    expect(() => reconcileInitialSubledgers([], [
      { tipo: 'CXP', cuentaContableId: 'cxp', moneda: 'CUP', debito: '5', credito: '5' },
    ])).toThrow('crédito');
  });

  it('rejects using one ledger account for both subledgers', () => {
    expect(() => reconcileInitialSubledgers([
      { tipo: 'CXC', cuentaContableId: 'a', moneda: 'CUP', saldo: '10' },
      { tipo: 'CXP', cuentaContableId: 'a', moneda: 'CUP', saldo: '10' },
    ], [])).toThrow('ambos');
  });

  it.each(['-1', 'NaN', '1.00001', '1e2'])('rejects invalid amounts: %s', (saldo) => {
    expect(() => reconcileInitialSubledgers([
      { tipo: 'CXC', cuentaContableId: 'cxc', moneda: 'CUP', saldo },
    ], [])).toThrow('importe');
  });

  it('rejects blank account IDs and malformed currencies', () => {
    expect(() => reconcileInitialSubledgers([
      { tipo: 'CXC', cuentaContableId: ' ', moneda: 'CUP', saldo: '1' },
    ], [])).toThrow('cuenta');
    expect(() => reconcileInitialSubledgers([
      { tipo: 'CXC', cuentaContableId: 'cxc', moneda: 'cup', saldo: '1' },
    ], [])).toThrow('moneda');
  });
});
