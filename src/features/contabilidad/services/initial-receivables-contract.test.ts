import { describe, expect, it } from 'vitest';
import { initialReceivablesContract } from './initial-receivables-contract';

const row = { referenciaFila: 'row-1', clienteId: 'cliente-1', moneda: 'CUP', saldo: '100.00' };

describe('contrato de cuentas por cobrar iniciales', () => {
  it('acepta una deuda externa sin venta ni factura y normaliza importes y moneda', () => {
    expect(initialReceivablesContract.parse({ cuentas: [{ ...row, moneda: ' cup ', saldo: '00100.5000' }] }))
      .toEqual({ cuentas: [{ ...row, moneda: 'CUP', saldo: '100.5' }] });
  });

  it('acepta una referencia externa opcional y un vencimiento civil válido', () => {
    const result = initialReceivablesContract.parse({ cuentas: [{ ...row, referenciaExterna: ' Doc 5 ', fechaVencimiento: '2024-02-29' }] });
    expect(result.cuentas[0]).toMatchObject({ referenciaExterna: 'Doc 5', fechaVencimiento: '2024-02-29' });
  });

  it.each(['0', '0.0000', '-1', '1e3', '1.00001', '10000000000000000', 'NaN', 'Infinity'])(
    'rechaza el saldo no positivo o fuera de precisión %s', (saldo) => {
      expect(initialReceivablesContract.safeParse({ cuentas: [{ ...row, saldo }] }).success).toBe(false);
    },
  );

  it.each(['2023-02-29', '2024-13-01', '2024-04-31', '2024-1-01', '2024-02-29T00:00:00Z'])(
    'rechaza fecha civil inválida %s', (fechaVencimiento) => {
      expect(initialReceivablesContract.safeParse({ cuentas: [{ ...row, fechaVencimiento }] }).success).toBe(false);
    },
  );

  it('rechaza claves de fila duplicadas después de normalizar espacios', () => {
    expect(initialReceivablesContract.safeParse({ cuentas: [row, { ...row, referenciaFila: ' row-1 ', clienteId: 'cliente-2' }] }).success).toBe(false);
  });

  it('permite la misma referencia externa en filas distintas sin fusionarlas', () => {
    const result = initialReceivablesContract.parse({ cuentas: [
      { ...row, referenciaExterna: 'REF-1' },
      { ...row, referenciaFila: 'row-2', clienteId: 'cliente-2', referenciaExterna: 'REF-1' },
    ] });
    expect(result.cuentas).toHaveLength(2);
  });

  it('rechaza campos inesperados, identificadores vacíos, moneda inválida y lotes vacíos', () => {
    for (const invalid of [
      { ...row, ventaId: 'v1' }, { ...row, facturaId: 'f1' }, { ...row, clienteId: ' ' },
      { ...row, referenciaFila: ' ' }, { ...row, moneda: '12' }, { ...row, saldo: 20 },
    ]) expect(initialReceivablesContract.safeParse({ cuentas: [invalid] }).success).toBe(false);
    expect(initialReceivablesContract.safeParse({ cuentas: [] }).success).toBe(false);
  });
});
