import { describe, expect, it } from 'vitest';
import { Prisma } from '@/generated/prisma';
import { resolveCashDebtCurrencyAmounts } from '../cash-debt-payment-valuation';

function importes(montoObligacion: number, montoCuenta: number) {
  return {
    montoObligacion: new Prisma.Decimal(montoObligacion),
    montoCuenta: new Prisma.Decimal(montoCuenta),
  };
}

describe('resolveCashDebtCurrencyAmounts', () => {
  it('convierte pago USD a principal y cuenta CUP con importe funcional', () => {
    expect(resolveCashDebtCurrencyAmounts({
      monedaObligacion: 'CUP', monedaFondos: 'USD', monedaCuenta: 'CUP',
      montoFondos: 10, montoFuncional: 250,
    })).toEqual(importes(250, 250));
  });

  it('mantiene principal USD y convierte el débito a cuenta CUP', () => {
    expect(resolveCashDebtCurrencyAmounts({
      monedaObligacion: 'USD', monedaFondos: 'USD', monedaCuenta: 'CUP',
      montoFondos: 10, montoFuncional: 250,
    })).toEqual(importes(10, 250));
  });

  it('mantiene importe nominal si la cuenta usa la moneda del pago', () => {
    expect(resolveCashDebtCurrencyAmounts({
      monedaObligacion: 'CUP', monedaFondos: 'USD', monedaCuenta: 'USD',
      montoFondos: 10, montoFuncional: 250,
    })).toEqual(importes(250, 10));
  });

  it('rechaza liquidar deuda USD directamente en CUP sin conversión nominal inversa definida', () => {
    expect(() => resolveCashDebtCurrencyAmounts({
      monedaObligacion: 'USD', monedaFondos: 'CUP', monedaCuenta: 'CUP',
      montoFondos: 250, montoFuncional: 250,
    })).toThrow('La moneda de los fondos debe coincidir con la obligación o la moneda funcional');
  });

  it('rechaza cuenta EUR sin una conversión verificable hacia esa moneda', () => {
    expect(() => resolveCashDebtCurrencyAmounts({
      monedaObligacion: 'USD', monedaFondos: 'USD', monedaCuenta: 'EUR',
      montoFondos: 10, montoFuncional: 250,
    })).toThrow('No se puede mover fondos a una cuenta distinta al tender o CUP');
  });

  it('usa la política MLC como moneda funcional para el delta de cuenta', () => {
    expect(resolveCashDebtCurrencyAmounts({
      monedaObligacion: 'USD', monedaFondos: 'USD', monedaCuenta: 'MLC',
      montoFondos: 10, montoFuncional: 250, functionalCurrency: 'MLC',
    })).toEqual(importes(10, 250));
  });

  it('rechaza convertir una obligación CUP con solo una tasa hacia MLC', () => {
    expect(() => resolveCashDebtCurrencyAmounts({
      monedaObligacion: 'CUP', monedaFondos: 'USD', monedaCuenta: 'MLC',
      montoFondos: 10, montoFuncional: 250, functionalCurrency: 'MLC',
    })).toThrow('La moneda de los fondos debe coincidir con la obligación o la moneda funcional');
  });

  it('acepta pago extranjero de obligación en moneda funcional no-CUP', () => {
    expect(resolveCashDebtCurrencyAmounts({
      monedaObligacion: 'USD', monedaFondos: 'CUP', monedaCuenta: 'USD',
      montoFondos: 250, montoFuncional: 10, functionalCurrency: 'USD',
    })).toEqual(importes(10, 10));
  });
});
