import { describe, expect, it } from 'vitest';
import { buildOpeningEntryLines } from './initialization-opening-lines';
import type { ValuedOpeningAccount } from './initialization-valuation';

function valued(overrides: Partial<ValuedOpeningAccount>): ValuedOpeningAccount {
  return {
    index: 0,
    numeroCuenta: 'QA-001',
    nombreCuenta: 'Operaciones',
    moneda: 'CUP',
    saldoOriginal: '100000',
    tasaCambio: 1,
    montoFuncional: 100000,
    fxEvidenceFingerprint: 'a'.repeat(64),
    sameCurrency: true,
    ...overrides,
  };
}

const capitalAccount = {
  nombreCuenta: 'Operaciones', nombreBanco: 'Banco QA', numeroCuenta: 'QA-001',
  tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '100000',
  origen: { tipo: 'CAPITAL_SOCIAL', tercero: 'Socio QA' },
} as const;

describe('líneas del asiento de apertura', () => {
  it('debita Bancos y acredita Capital social por una cuenta en moneda funcional', () => {
    const result = buildOpeningEntryLines({ cuentas: [capitalAccount], valued: [valued({})], monedaFuncional: 'CUP' });
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({ lado: 'DEBE', rolCuenta: 'BANCOS', moneda: 'CUP', montoOriginal: '100000', montoFuncional: '100000' });
    expect(result.lines[1]).toMatchObject({ lado: 'HABER', rolCuenta: 'CAPITAL_SOCIAL', moneda: 'CUP', montoOriginal: '100000', montoFuncional: '100000' });
    expect(result).toMatchObject({ totalDebeFuncional: '100000', totalHaberFuncional: '100000', balanced: true });
  });

  it('convierte la moneda extranjera con la tasa valorada', () => {
    const usd = valued({ moneda: 'USD', saldoOriginal: '100', tasaCambio: 400, montoFuncional: 40000, sameCurrency: false });
    const result = buildOpeningEntryLines({
      cuentas: [{ ...capitalAccount, moneda: 'USD', saldoInicial: '100' }],
      valued: [usd],
      monedaFuncional: 'CUP',
    });
    expect(result.lines[0]).toMatchObject({ lado: 'DEBE', rolCuenta: 'BANCOS', moneda: 'USD', montoOriginal: '100', montoFuncional: '40000' });
    expect(result.lines[1]).toMatchObject({ lado: 'HABER', rolCuenta: 'CAPITAL_SOCIAL', montoFuncional: '40000' });
    expect(result).toMatchObject({ totalDebeFuncional: '40000', totalHaberFuncional: '40000', balanced: true });
  });

  it('acredita Resultados acumulados para un saldo no documentado', () => {
    const usd = valued({ numeroCuenta: 'QA-002', moneda: 'USD', saldoOriginal: '100', tasaCambio: 400, montoFuncional: 40000, sameCurrency: false });
    const result = buildOpeningEntryLines({
      cuentas: [{ nombreCuenta: 'Caja', nombreBanco: 'Banco QA', numeroCuenta: 'QA-002', tipoCuenta: 'CORRIENTE', moneda: 'USD', saldoInicial: '100', origenNoDocumentado: true }],
      valued: [usd],
      monedaFuncional: 'CUP',
    });
    expect(result.lines[1]).toMatchObject({ lado: 'HABER', rolCuenta: 'RESULTADOS_ACUMULADOS', montoFuncional: '40000' });
  });

  it('acredita Deudas recibidas para un préstamo', () => {
    const result = buildOpeningEntryLines({
      cuentas: [{ ...capitalAccount, origen: { tipo: 'PRESTAMO', tercero: 'Banco QA' } }],
      valued: [valued({})],
      monedaFuncional: 'CUP',
    });
    expect(result.lines[1]).toMatchObject({ lado: 'HABER', rolCuenta: 'DEUDAS_RECIBIDAS' });
  });

  it('excluye los anticipos: su asiento lo emite su propio flujo', () => {
    const result = buildOpeningEntryLines({
      cuentas: [{ ...capitalAccount, origen: { tipo: 'ANTICIPO', tercero: 'Cliente QA', tipoPagoId: 'tp-1' } }],
      valued: [valued({})],
      monedaFuncional: 'CUP',
    });
    expect(result.lines).toHaveLength(0);
    expect(result.excludedAnticipoIndexes).toEqual([0]);
    expect(result).toMatchObject({ totalDebeFuncional: '0', totalHaberFuncional: '0', balanced: true });
  });

  it('debita CxC y acredita Resultados acumulados por cada fila de CxC', () => {
    const result = buildOpeningEntryLines({
      cuentas: [capitalAccount], valued: [valued({})], monedaFuncional: 'CUP',
      cuentasPorCobrar: [{
        referenciaFila: 'cxc-1', moneda: 'CUP', montoOriginal: '500',
        tasaCambio: '1', montoFuncional: '500', fxEvidenceFingerprint: 'b'.repeat(64),
      }],
    });
    expect(result.lines).toHaveLength(4);
    expect(result.lines[2]).toMatchObject({
      lado: 'DEBE', rolCuenta: 'CXC_CLIENTES', numeroCuenta: 'cxc-1',
      moneda: 'CUP', montoOriginal: '500', tasaCambio: 1, montoFuncional: '500',
      fxEvidenceFingerprint: 'b'.repeat(64),
    });
    expect(result.lines[3]).toMatchObject({
      lado: 'HABER', rolCuenta: 'RESULTADOS_ACUMULADOS', numeroCuenta: 'cxc-1', montoFuncional: '500',
    });
    expect(result).toMatchObject({ totalDebeFuncional: '100500', totalHaberFuncional: '100500', balanced: true });
  });

  it('debita Resultados acumulados y acredita CxP por cada fila de CxP en divisa', () => {
    const result = buildOpeningEntryLines({
      cuentas: [], valued: [], monedaFuncional: 'CUP',
      cuentasPorPagar: [{
        referenciaFila: 'cxp-1', moneda: 'USD', montoOriginal: '100',
        tasaCambio: '24', montoFuncional: '2400', fxEvidenceFingerprint: 'c'.repeat(64),
      }],
    });
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({
      lado: 'DEBE', rolCuenta: 'RESULTADOS_ACUMULADOS', numeroCuenta: 'cxp-1',
      moneda: 'USD', montoOriginal: '100', tasaCambio: 24, montoFuncional: '2400',
      fxEvidenceFingerprint: 'c'.repeat(64),
    });
    expect(result.lines[1]).toMatchObject({
      lado: 'HABER', rolCuenta: 'CXP_PROVEEDORES', numeroCuenta: 'cxp-1', montoFuncional: '2400',
    });
    expect(result).toMatchObject({ totalDebeFuncional: '2400', totalHaberFuncional: '2400', balanced: true });
  });

  it('no mezcla los índices de banco, inventario y submayor', () => {
    const result = buildOpeningEntryLines({
      cuentas: [capitalAccount], valued: [valued({})], monedaFuncional: 'CUP',
      initialInventoryTotalFuncional: '1000',
      cuentasPorCobrar: [{
        referenciaFila: 'cxc-1', moneda: 'CUP', montoOriginal: '500',
        tasaCambio: '1', montoFuncional: '500', fxEvidenceFingerprint: null,
      }],
      cuentasPorPagar: [{
        referenciaFila: 'cxp-1', moneda: 'CUP', montoOriginal: '300',
        tasaCambio: '1', montoFuncional: '300', fxEvidenceFingerprint: null,
      }],
    });
    // banco (2) + inventario (2) + CxC (2) + CxP (2) = 8 líneas en 4 índices distintos
    expect(result.lines).toHaveLength(8);
    const byIndex = new Map<number, number>();
    result.lines.forEach((line) => byIndex.set(line.index, (byIndex.get(line.index) ?? 0) + 1));
    expect([...byIndex.values()]).toEqual([2, 2, 2, 2]);
    expect(result).toMatchObject({ totalDebeFuncional: '101800', totalHaberFuncional: '101800', balanced: true });
  });

  it('no genera líneas para saldos cero', () => {
    const result = buildOpeningEntryLines({
      cuentas: [{ nombreCuenta: 'Caja', nombreBanco: 'Banco QA', numeroCuenta: 'QA-003', tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldoInicial: '0' }],
      valued: [valued({ numeroCuenta: 'QA-003', saldoOriginal: '0', montoFuncional: 0 })],
      monedaFuncional: 'CUP',
    });
    expect(result.lines).toHaveLength(0);
    expect(result.balanced).toBe(true);
  });

  it('balancea varias cuentas en varias monedas', () => {
    const usd = valued({ index: 1, numeroCuenta: 'QA-002', moneda: 'USD', saldoOriginal: '100', tasaCambio: 400, montoFuncional: 40000, sameCurrency: false });
    const result = buildOpeningEntryLines({
      cuentas: [
        capitalAccount,
        { nombreCuenta: 'Caja USD', nombreBanco: 'Banco QA', numeroCuenta: 'QA-002', tipoCuenta: 'CORRIENTE', moneda: 'USD', saldoInicial: '100', origenNoDocumentado: true },
      ],
      valued: [valued({}), usd],
      monedaFuncional: 'CUP',
    });
    expect(result.lines).toHaveLength(4);
    expect(result).toMatchObject({ totalDebeFuncional: '140000', totalHaberFuncional: '140000', balanced: true });
  });
});
