import { describe, expect, it } from 'vitest';
import { reconcileInitialBankBalances } from './initial-bank-reconciliation';

describe('reconcileInitialBankBalances', () => {
  it('sums balances exactly by ledger account and currency without inferring an origin', () => {
    expect(reconcileInitialBankBalances([
      { cuentaContableId: 'banco', moneda: 'CUP', saldo: '0.1' },
      { cuentaContableId: 'banco', moneda: 'CUP', saldo: '0.2' },
      { cuentaContableId: 'banco', moneda: 'USD', saldo: '100' },
    ], [
      { cuentaContableId: 'banco', moneda: 'USD', debito: '100', credito: '0' },
      { cuentaContableId: 'banco', moneda: 'CUP', debito: '0.3', credito: '0' },
    ])).toEqual({ conciliado: true });
  });

  it('rejects a mismatch even if totals across currencies happen to match', () => {
    expect(() => reconcileInitialBankBalances([
      { cuentaContableId: 'banco', moneda: 'CUP', saldo: '100' },
    ], [{ cuentaContableId: 'banco', moneda: 'USD', debito: '100', credito: '0' }]))
      .toThrow('no coinciden');
  });

  it('rejects extra ledger amounts and credit lines', () => {
    expect(() => reconcileInitialBankBalances([], [
      { cuentaContableId: 'banco', moneda: 'CUP', debito: '1', credito: '0' },
    ])).toThrow('no coinciden');
    expect(() => reconcileInitialBankBalances([
      { cuentaContableId: 'banco', moneda: 'CUP', saldo: '1' },
    ], [{ cuentaContableId: 'banco', moneda: 'CUP', debito: '1', credito: '1' }]))
      .toThrow('crédito');
  });

  it.each(['-1', 'NaN', 'Infinity', 'invalid'])('rejects invalid balance %s', (saldo) => {
    expect(() => reconcileInitialBankBalances([
      { cuentaContableId: 'banco', moneda: 'CUP', saldo },
    ], [])).toThrow('saldo');
  });

  it('rejects missing identity and negative debit', () => {
    expect(() => reconcileInitialBankBalances([
      { cuentaContableId: '', moneda: 'CUP', saldo: '0' },
    ], [])).toThrow('cuenta contable');
    expect(() => reconcileInitialBankBalances([], [
      { cuentaContableId: 'banco', moneda: 'CUP', debito: '-1', credito: '0' },
    ])).toThrow('débito');
  });
});
