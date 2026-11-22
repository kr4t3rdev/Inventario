import { describe, expect, it } from 'vitest';
import {
  calculateOpeningAccountTotals,
  findOpeningCurrencyRateConflicts,
  findUnpersistableOpeningRateConflicts,
  resolveOpeningCurrencyRates,
} from './initialization-currency-rates';

describe('valoración de cuentas en la revisión de saldos iniciales', () => {
  it('mantiene tasas diferentes por cuenta sin consolidarlas en una tasa global', () => {
    const accounts = [
      { moneda: 'USD', saldoInicial: '100', tasaCambio: '300' },
      { moneda: 'USD', saldoInicial: '100', tasaCambio: '400' },
    ];
    const rates = resolveOpeningCurrencyRates(accounts, 'CUP');

    expect(rates).not.toHaveProperty('USD');
    expect(findOpeningCurrencyRateConflicts(accounts, 'CUP')).toEqual(['USD']);
    expect(calculateOpeningAccountTotals(accounts, 'CUP', rates).funcional).toBeNull();
  });

  it('usa la misma tasa global que aplicará el servidor cuando las cuentas coinciden', () => {
    const accounts = [
      { moneda: 'USD', saldoInicial: '100', tasaCambio: '300' },
      { moneda: 'USD', saldoInicial: '100', tasaCambio: '300' },
    ];

    expect(resolveOpeningCurrencyRates(accounts, 'CUP')).toEqual({ USD: '300' });
    expect(calculateOpeningAccountTotals(accounts, 'CUP', { USD: '300' }).funcional).toBe(60000);
  });

  it('preserva tasas explícitas del borrador sin inferir tasas globales de otras secciones', () => {
    const accounts = [{ moneda: 'EUR', saldoInicial: '50', tasaCambio: '' }];

    expect(resolveOpeningCurrencyRates(accounts, 'CUP', { EUR: '400' })).toEqual({ EUR: '400' });
  });

  it('trata como iguales tasas con distinta representación decimal', () => {
    const accounts = [
      { moneda: 'USD', saldoInicial: '1', tasaCambio: '300' },
      { moneda: 'USD', saldoInicial: '1', tasaCambio: '300.00' },
    ];

    expect(findOpeningCurrencyRateConflicts(accounts, 'CUP')).toEqual([]);
    expect(resolveOpeningCurrencyRates(accounts, 'CUP')).toEqual({ USD: '300' });
  });

  it('valora en cero una cuenta extranjera sin tasa cuando su saldo es cero', () => {
    const accounts = [{ moneda: 'USD', saldoInicial: '0', tasaCambio: '' }];

    expect(calculateOpeningAccountTotals(accounts, 'CUP').funcional).toBe(0);
  });

  it('redondea a cuatro decimales cada conversión antes de sumar', () => {
    const accounts = [
      { moneda: 'USD', saldoInicial: '1', tasaCambio: '1.234567' },
      { moneda: 'USD', saldoInicial: '1', tasaCambio: '1.234567' },
    ];

    expect(calculateOpeningAccountTotals(accounts, 'CUP', { USD: '1.234567' }).funcional).toBe(2.4692);
  });

  it('detecta tasas de cuentas no documentadas que el borrador no puede conservar', () => {
    const accounts = [
      { moneda: 'USD', saldoInicial: '1', tasaCambio: '300', origen: 'NO_DOCUMENTADO' },
      { moneda: 'USD', saldoInicial: '1', tasaCambio: '400', origen: 'NO_DOCUMENTADO' },
    ];

    expect(findUnpersistableOpeningRateConflicts(accounts, 'CUP')).toEqual(['USD']);
    expect(findUnpersistableOpeningRateConflicts([
      ...accounts,
      { moneda: 'EUR', saldoInicial: '1', tasaCambio: '400', origen: 'CAPITAL_SOCIAL' },
    ], 'CUP')).toEqual(['USD']);
  });
});
