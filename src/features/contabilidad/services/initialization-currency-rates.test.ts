import { describe, expect, it } from 'vitest';
import {
  findOpeningCurrencyRateConflicts,
  findUnpersistableOpeningRateConflicts,
  resolveOpeningCurrencyRates,
} from './initialization-currency-rates';

describe('resolución de tasas para saldos bancarios iniciales', () => {
  it('detecta tasas distintas y evita sobrescribir una tasa explícita', () => {
    const accounts = [
      { moneda: 'USD', saldoInicial: '100', tasaCambio: '300' },
      { moneda: 'USD', saldoInicial: '100', tasaCambio: '400' },
    ];

    expect(findOpeningCurrencyRateConflicts(accounts, 'CUP')).toEqual(['USD']);
    expect(resolveOpeningCurrencyRates(accounts, 'CUP', { USD: '350', EUR: '400' }))
      .toEqual({ EUR: '400' });
  });

  it('consolida tasas bancarias iguales y normaliza formatos equivalentes', () => {
    const accounts = [
      { moneda: 'USD', saldoInicial: '1', tasaCambio: '300' },
      { moneda: 'USD', saldoInicial: '1', tasaCambio: '300.00' },
    ];

    expect(findOpeningCurrencyRateConflicts(accounts, 'CUP')).toEqual([]);
    expect(resolveOpeningCurrencyRates(accounts, 'CUP')).toEqual({ USD: '300' });
  });

  it('conserva tasas explícitas de borrador si no hay tasa bancaria para esa moneda', () => {
    expect(resolveOpeningCurrencyRates([
      { moneda: 'EUR', saldoInicial: '50', tasaCambio: '' },
    ], 'CUP', { EUR: '400' })).toEqual({ EUR: '400' });
  });

  it('marca solo tasas conflictivas de cuentas sin procedencia persistible', () => {
    const accounts = [
      { moneda: 'USD', saldoInicial: '1', tasaCambio: '300', origen: 'NO_DOCUMENTADO' },
      { moneda: 'USD', saldoInicial: '1', tasaCambio: '400', origen: 'NO_DOCUMENTADO' },
      { moneda: 'EUR', saldoInicial: '1', tasaCambio: '400', origen: 'CAPITAL_SOCIAL' },
    ];

    expect(findUnpersistableOpeningRateConflicts(accounts, 'CUP')).toEqual(['USD']);
  });
});
