import { describe, expect, it } from 'vitest';
import { initialBankDraftSchema } from './initial-bank-draft';

const account = {
  nombreCuenta: 'Cuenta principal',
  nombreBanco: 'Banco',
  numeroCuenta: '123',
  tipoCuenta: 'CORRIENTE',
  moneda: 'CUP',
  saldo: '100000.00',
  cuentaContableId: 'cuenta-1',
};

describe('initialBankDraftSchema', () => {
  it('rechaza un tipo de cuenta desconocido', () => {
    expect(initialBankDraftSchema.safeParse({ cuentas: [{ ...account, tipoCuenta: 'INVENTADO' }] }).success).toBe(false);
  });

  it('acepta un saldo existente sin exigir origen del dinero', () => {
    expect(initialBankDraftSchema.safeParse({ cuentas: [account] }).success).toBe(true);
  });

  it('normaliza moneda y saldo sin perder centavos', () => {
    const result = initialBankDraftSchema.parse({ cuentas: [{ ...account, moneda: ' cup ', saldo: '00012.30' }] });
    expect(result.cuentas[0]).toMatchObject({ moneda: 'CUP', saldo: '12.3' });
  });

  it.each(['-1', '1.001', '1e3', '90071992547409.92', '70368744177664.01'])('rechaza saldo inválido o no representable %s', (saldo) => {
    expect(initialBankDraftSchema.safeParse({ cuentas: [{ ...account, saldo }] }).success).toBe(false);
  });

  it('rechaza números de cuenta repetidos aunque cambien banco y moneda', () => {
    expect(initialBankDraftSchema.safeParse({ cuentas: [account, { ...account, numeroCuenta: ' 123 ', nombreBanco: 'Otro', moneda: 'USD' }] }).success).toBe(false);
  });

  it('rechaza importes numéricos y datos inesperados', () => {
    expect(initialBankDraftSchema.safeParse({ cuentas: [{ ...account, saldo: 10 }] }).success).toBe(false);
    expect(initialBankDraftSchema.safeParse({ cuentas: [{ ...account, origen: 'CAPITAL' }] }).success).toBe(false);
  });

  it('exige datos completos y limita la cantidad de cuentas', () => {
    expect(initialBankDraftSchema.safeParse({ cuentas: [{ ...account, cuentaContableId: ' ' }] }).success).toBe(false);
    expect(initialBankDraftSchema.safeParse({ cuentas: [] }).success).toBe(false);
    expect(initialBankDraftSchema.safeParse({ cuentas: Array.from({ length: 101 }, (_, i) => ({ ...account, numeroCuenta: String(i) })) }).success).toBe(false);
  });
});
