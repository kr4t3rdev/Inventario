import { describe, expect, it } from 'vitest';
import { calculateOpeningAccountTotals } from './initialization-currency-valuation';

describe('valoración de cuentas bancarias iniciales', () => {
  it('suma moneda funcional y convierte moneda extranjera a cuatro decimales', () => {
    const accounts = [
      { moneda: 'CUP', saldoInicial: '100', tasaCambio: '' },
      { moneda: 'USD', saldoInicial: '2', tasaCambio: '300' },
    ];

    expect(calculateOpeningAccountTotals(accounts, 'CUP', { USD: '300' })).toEqual({
      porMoneda: [{ moneda: 'CUP', total: 100 }, { moneda: 'USD', total: 2 }],
      funcional: 700,
    });
  });

  it('redondea cada conversión antes de sumar las cuentas', () => {
    const accounts = [
      { moneda: 'USD', saldoInicial: '1', tasaCambio: '1.234567' },
      { moneda: 'USD', saldoInicial: '1', tasaCambio: '1.234567' },
    ];

    expect(calculateOpeningAccountTotals(accounts, 'CUP', { USD: '1.234567' }).funcional)
      .toBe(2.4692);
  });

  it('permite saldo extranjero cero aunque no tenga tasa', () => {
    expect(calculateOpeningAccountTotals([
      { moneda: 'USD', saldoInicial: '0', tasaCambio: '' },
    ], 'CUP').funcional).toBe(0);
  });

  it('devuelve total funcional indeterminado si falta una tasa requerida', () => {
    expect(calculateOpeningAccountTotals([
      { moneda: 'USD', saldoInicial: '100', tasaCambio: '' },
    ], 'CUP').funcional).toBeNull();
  });

  it('no calcula un total funcional con tasas bancarias conflictivas', () => {
    expect(calculateOpeningAccountTotals([
      { moneda: 'USD', saldoInicial: '100', tasaCambio: '300' },
      { moneda: 'USD', saldoInicial: '100', tasaCambio: '400' },
    ], 'CUP').funcional).toBeNull();
  });
});
