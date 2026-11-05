import { describe, expect, it } from 'vitest';
import { calculateLedgerBalance } from './financial-ledger-balance';

describe('calculateLedgerBalance', () => {
  it('acumula por cuenta con precisión decimal y respeta la naturaleza', () => {
    const result = calculateLedgerBalance([
      { id: '1', code: '1.1', name: 'Caja', type: 'ACTIVO', nature: 'DEUDORA', debit: '0.1000', credit: '0' },
      { id: '1', code: '1.1', name: 'Caja', type: 'ACTIVO', nature: 'DEUDORA', debit: '0.2000', credit: '0' },
      { id: '2', code: '2.1', name: 'Deuda', type: 'PASIVO', nature: 'ACREEDORA', debit: '0.1', credit: '0.4' },
    ]);

    expect(result).toEqual([
      { id: '1', code: '1.1', name: 'Caja', type: 'ACTIVO', nature: 'DEUDORA', balance: '0.3' },
      { id: '2', code: '2.1', name: 'Deuda', type: 'PASIVO', nature: 'ACREEDORA', balance: '0.3' },
    ]);
  });

  it('conserva saldos contrarios y ordena por código sin depender del orden de entrada', () => {
    const result = calculateLedgerBalance([
      { id: '2', code: '2', name: 'Pasivo', type: 'PASIVO', nature: 'ACREEDORA', debit: '7', credit: '2' },
      { id: '1', code: '1', name: 'Activo', type: 'ACTIVO', nature: 'DEUDORA', debit: '2', credit: '7' },
    ]);
    expect(result.map(({ id, balance }) => ({ id, balance }))).toEqual([
      { id: '1', balance: '-5' },
      { id: '2', balance: '-5' },
    ]);
  });

  it('conserva la precisión al acumular importes cercanos al límite de la columna', () => {
    const line = { id: '1', code: '1', name: 'Caja', type: 'ACTIVO' as const, nature: 'DEUDORA' as const, debit: '9999999999999999.9999', credit: '0' };
    expect(calculateLedgerBalance([line, line])[0].balance).toBe('19999999999999999.9998');
  });

  it('rechaza importes inválidos, negativos o metadatos inconsistentes de una cuenta', () => {
    const line = { id: '1', code: '1', name: 'Caja', type: 'ACTIVO' as const, nature: 'DEUDORA' as const, debit: '1', credit: '0' };
    expect(() => calculateLedgerBalance([{ ...line, debit: 'NaN' }])).toThrow();
    expect(() => calculateLedgerBalance([{ ...line, debit: '-1' }])).toThrow();
    expect(() => calculateLedgerBalance([line, { ...line, code: '2' }])).toThrow();
  });
});
