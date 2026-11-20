import { describe, expect, it } from 'vitest';
import { initialPayablesContract } from './initial-payables-contract';

const row = { referenciaFila: 'fila-1', proveedorId: 'proveedor-1', moneda: 'CUP', saldo: '100.00' };

describe('contrato de cuentas por pagar iniciales', () => {
  it('acepta una obligación externa sin compra ni factura y normaliza moneda e importe', () => {
    expect(initialPayablesContract.parse({ cuentas: [{ ...row, moneda: ' cup ', saldo: '00100.5000' }] }))
      .toEqual({ cuentas: [{ ...row, moneda: 'CUP', saldo: '100.5' }] });
  });

  it('acepta referencia externa opcional y vencimiento civil válido', () => {
    expect(initialPayablesContract.parse({ cuentas: [{ ...row, referenciaExterna: ' Doc 5 ', fechaVencimiento: '2024-02-29' }] }).cuentas[0])
      .toMatchObject({ referenciaExterna: 'Doc 5', fechaVencimiento: '2024-02-29' });
  });

  it.each(['0', '0.0000', '-1', '1e3', '1.00001', '10000000000000000', 'NaN', 'Infinity'])(
    'rechaza el saldo no positivo o fuera de precisión %s', (saldo) => {
      expect(initialPayablesContract.safeParse({ cuentas: [{ ...row, saldo }] }).success).toBe(false);
    },
  );

  it.each(['2023-02-29', '2024-13-01', '2024-04-31', '2024-1-01', '2024-02-29T00:00:00Z'])(
    'rechaza fecha civil inválida %s', (fechaVencimiento) => {
      expect(initialPayablesContract.safeParse({ cuentas: [{ ...row, fechaVencimiento }] }).success).toBe(false);
    },
  );

  it('acepta una tasa de cambio por fila sin normalizarla', () => {
    expect(initialPayablesContract.parse({ cuentas: [{ ...row, moneda: 'USD', tasaCambio: '24.5000' }] }).cuentas[0])
      .toMatchObject({ moneda: 'USD', tasaCambio: '24.5000' });
  });

  it.each(['0', '0.0000', '-1', '1e3', '1.000000001', 'NaN'])(
    'rechaza la tasa de cambio no positiva o fuera de precisión %s', (tasaCambio) => {
      expect(initialPayablesContract.safeParse({ cuentas: [{ ...row, tasaCambio }] }).success).toBe(false);
    },
  );

  it('rechaza referencias de fila duplicadas después de recortar espacios', () => {
    expect(initialPayablesContract.safeParse({ cuentas: [row, { ...row, referenciaFila: ' fila-1 ', proveedorId: 'otro' }] }).success).toBe(false);
  });

  it('permite referencias externas repetidas en filas independientes', () => {
    expect(initialPayablesContract.parse({ cuentas: [
      { ...row, referenciaExterna: 'REF-1' },
      { ...row, referenciaFila: 'fila-2', proveedorId: 'otro', referenciaExterna: 'REF-1' },
    ] }).cuentas).toHaveLength(2);
  });

  it('rechaza campos inesperados, proveedor o referencia vacíos, moneda inválida y lote vacío', () => {
    for (const invalid of [
      { ...row, gastoCompraId: 'gasto' }, { ...row, facturaId: 'factura' }, { ...row, proveedorId: ' ' },
      { ...row, referenciaFila: ' ' }, { ...row, moneda: '12' }, { ...row, saldo: 20 },
    ]) expect(initialPayablesContract.safeParse({ cuentas: [invalid] }).success).toBe(false);
    expect(initialPayablesContract.safeParse({ cuentas: [] }).success).toBe(false);
  });
});
