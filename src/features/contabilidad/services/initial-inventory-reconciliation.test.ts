import { describe, expect, it } from 'vitest';
import { reconcileInitialInventory } from './initial-inventory-reconciliation';

const item = { cuentaContableId: 'inventario', moneda: 'CUP', cantidad: '3', costoUnitario: '0.1' };
const line = { cuentaContableId: 'inventario', moneda: 'CUP', debito: '0.3', credito: '0' };

describe('reconcileInitialInventory', () => {
  it('valora y suma existencias exactamente por cuenta y moneda', () => {
    expect(reconcileInitialInventory([
      item,
      { ...item, cantidad: '2', costoUnitario: '0.1' },
      { ...item, cuentaContableId: 'otra', moneda: 'USD', cantidad: '1', costoUnitario: '12' },
    ], [
      { ...line, debito: '0.5' },
      { ...line, cuentaContableId: 'otra', moneda: 'USD', debito: '12' },
    ])).toEqual({ conciliado: true });
  });

  it('rechaza diferencias aunque coincida el total entre monedas o cuentas', () => {
    expect(() => reconcileInitialInventory([item], [{ ...line, moneda: 'USD' }]))
      .toThrow('no coincide');
    expect(() => reconcileInitialInventory([item], [{ ...line, cuentaContableId: 'otra' }]))
      .toThrow('no coincide');
    expect(() => reconcileInitialInventory([item], [])).toThrow('no coincide');
    expect(() => reconcileInitialInventory([], [line])).toThrow('no coincide');
  });

  it('rechaza créditos en líneas de inventario', () => {
    expect(() => reconcileInitialInventory([item], [{ ...line, credito: '0.1' }]))
      .toThrow('crédito');
  });

  it('acepta existencias con costo conocido igual a cero', () => {
    expect(reconcileInitialInventory(
      [{ ...item, costoUnitario: '0' }],
      [{ ...line, debito: '0' }],
    )).toEqual({ conciliado: true });
  });

  it.each(['0', '-1', 'NaN', 'Infinity', '0.00001', '10000000000000000'])(
    'rechaza cantidades no positivas o fuera de precisión: %s', (cantidad) => {
      expect(() => reconcileInitialInventory([{ ...item, cantidad }], [line])).toThrow('cantidad');
    },
  );

  it.each(['-1', 'NaN', 'Infinity', '0.00001', '10000000000000000'])(
    'rechaza costos negativos o fuera de precisión: %s', (costoUnitario) => {
      expect(() => reconcileInitialInventory([{ ...item, costoUnitario }], [line])).toThrow('costo');
    },
  );

  it('rechaza un producto que no cabe en la precisión contable sin redondearlo', () => {
    expect(() => reconcileInitialInventory([
      { ...item, cantidad: '0.0001', costoUnitario: '0.0001' },
    ], [])).toThrow('precisión');
    expect(() => reconcileInitialInventory([
      { ...item, cantidad: '9999999999999999', costoUnitario: '2' },
    ], [])).toThrow('precisión');
  });

  it('rechaza identificadores, monedas e importes inválidos', () => {
    expect(() => reconcileInitialInventory([{ ...item, cuentaContableId: '' }], [line]))
      .toThrow('cuenta contable');
    expect(() => reconcileInitialInventory([{ ...item, moneda: 'cup' }], [line]))
      .toThrow('moneda');
    expect(() => reconcileInitialInventory([item], [{ ...line, debito: '-1' }]))
      .toThrow('débito');
  });
});
