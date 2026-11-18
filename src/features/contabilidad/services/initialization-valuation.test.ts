import { describe, expect, it } from 'vitest';
import { valueOpeningAccounts } from './initialization-valuation';

const base = {
  fechaCorte: '2026-11-01',
  monedaFuncional: 'CUP',
  cuentas: [{
    nombreCuenta: 'Operaciones',
    nombreBanco: 'Banco QA',
    numeroCuenta: 'QA-001',
    tipoCuenta: 'CORRIENTE',
    moneda: 'CUP',
    saldoInicial: '100000',
  }],
};

describe('valoración FX de la apertura', () => {
  it('valora en la misma moneda con tasa 1 y evidencia', () => {
    const [valued] = valueOpeningAccounts(base);
    expect(valued).toMatchObject({ numeroCuenta: 'QA-001', moneda: 'CUP', saldoOriginal: '100000', tasaCambio: 1, montoFuncional: 100000, sameCurrency: true });
    expect(valued.fxEvidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('convierte con la tasa del mapa por moneda', () => {
    const [valued] = valueOpeningAccounts({
      ...base,
      tasas: { USD: '400' },
      cuentas: [{ ...base.cuentas[0], moneda: 'USD', saldoInicial: '100' }],
    });
    expect(valued).toMatchObject({ tasaCambio: 400, montoFuncional: 40000, sameCurrency: false });
    expect(valued.fxEvidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('usa la tasa del origen cuando el mapa no trae la moneda', () => {
    const [valued] = valueOpeningAccounts({
      ...base,
      cuentas: [{ ...base.cuentas[0], moneda: 'USD', saldoInicial: '100', origen: { tipo: 'CAPITAL_SOCIAL', tercero: 'Socio QA', tasaCambio: '420' } }],
    });
    expect(valued).toMatchObject({ tasaCambio: 420, montoFuncional: 42000 });
  });

  it('el mapa de tasas tiene precedencia sobre la tasa del origen', () => {
    const [valued] = valueOpeningAccounts({
      ...base,
      tasas: { USD: '400' },
      cuentas: [{ ...base.cuentas[0], moneda: 'USD', saldoInicial: '100', origen: { tipo: 'CAPITAL_SOCIAL', tercero: 'Socio QA', tasaCambio: '420' } }],
    });
    expect(valued).toMatchObject({ tasaCambio: 400, montoFuncional: 40000 });
  });

  it('falla cerrado si una cuenta extranjera con saldo no tiene tasa', () => {
    expect(() => valueOpeningAccounts({
      ...base,
      cuentas: [{ ...base.cuentas[0], moneda: 'USD', saldoInicial: '100' }],
    })).toThrowError(expect.objectContaining({ code: 'TASA_CAMBIO_REQUERIDA' }));
  });

  it('valora un saldo cero sin exigir tasa', () => {
    const [valued] = valueOpeningAccounts({
      ...base,
      cuentas: [{ ...base.cuentas[0], moneda: 'USD', saldoInicial: '0' }],
    });
    expect(valued).toMatchObject({ tasaCambio: null, montoFuncional: 0, sameCurrency: false });
  });

  it('la evidencia depende de la fecha de corte', () => {
    const [first] = valueOpeningAccounts({ ...base, tasas: { USD: '400' }, cuentas: [{ ...base.cuentas[0], moneda: 'USD', saldoInicial: '100' }] });
    const [second] = valueOpeningAccounts({ ...base, fechaCorte: '2026-11-02', tasas: { USD: '400' }, cuentas: [{ ...base.cuentas[0], moneda: 'USD', saldoInicial: '100' }] });
    expect(first.fxEvidenceFingerprint).not.toBe(second.fxEvidenceFingerprint);
  });
});
