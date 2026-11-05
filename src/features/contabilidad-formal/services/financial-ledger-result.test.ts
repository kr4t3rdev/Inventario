import { describe, expect, it } from 'vitest';
import { calculateLedgerResult } from './financial-ledger-result';
import type { FinancialAccountBalance } from './financial-ledger-balance';

describe('calculateLedgerResult', () => {
  it('agrupa ingresos, costos y gastos, incluyendo saldos de naturaleza contraria', () => {
    const accounts: FinancialAccountBalance[] = [
      { id: '1', code: '4.1', name: 'Ventas', type: 'INGRESO', nature: 'ACREEDORA', balance: '100.1' },
      { id: '2', code: '4.2', name: 'Devoluciones', type: 'INGRESO', nature: 'DEUDORA', balance: '0.2' },
      { id: '3', code: '5.1', name: 'Costo', type: 'COSTO', nature: 'DEUDORA', balance: '40.3' },
      { id: '4', code: '6.1', name: 'Gasto', type: 'GASTO', nature: 'DEUDORA', balance: '9.4' },
      { id: '5', code: '1.1', name: 'Caja', type: 'ACTIVO', nature: 'DEUDORA', balance: '50.2' },
    ];
    expect(calculateLedgerResult(accounts)).toEqual({
      income: '99.9', costs: '40.3', expenses: '9.4', net: '50.2',
    });
  });

  it('mantiene precisión decimal en sumas grandes y conserva pérdidas', () => {
    const accounts: FinancialAccountBalance[] = [
      { id: '1', code: '6', name: 'Gasto', type: 'GASTO', nature: 'DEUDORA', balance: '9999999999999999.9999' },
      { id: '2', code: '6.1', name: 'Otro gasto', type: 'GASTO', nature: 'DEUDORA', balance: '9999999999999999.9999' },
    ];
    expect(calculateLedgerResult(accounts)).toEqual({
      income: '0', costs: '0', expenses: '19999999999999999.9998', net: '-19999999999999999.9998',
    });
  });

  it('rechaza un saldo no finito o no numérico', () => {
    const account: FinancialAccountBalance = {
      id: '1', code: '4', name: 'Ventas', type: 'INGRESO', nature: 'ACREEDORA', balance: 'NaN',
    };
    expect(() => calculateLedgerResult([account])).toThrow();
    expect(() => calculateLedgerResult([{ ...account, balance: 'invalido' }])).toThrow();
  });
});
