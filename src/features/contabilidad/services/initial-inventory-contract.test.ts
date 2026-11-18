import { describe, expect, it } from 'vitest';

import { initialInventoryContract } from './initial-inventory-contract';

const base = {
  fechaCorte: '2026-11-10',
  monedaFuncional: 'CUP',
  inventario: [{
    referenciaFila: 'existencia-1',
    productoId: 'producto-1',
    almacenId: 'almacen-1',
    ubicacionId: 'ubicacion-1',
    loteCodigo: 'LOTE-001',
    cantidad: '12',
    costoUnitario: '250.50',
    moneda: 'CUP',
  }],
};

describe('contrato de inventario inicial', () => {
  it('normaliza una existencia por producto, almacén, ubicación y lote', () => {
    expect(initialInventoryContract.parse(base)).toEqual({
      ...base,
      monedaFuncional: 'CUP',
      inventario: [{
        ...base.inventario[0],
        moneda: 'CUP',
        cantidad: '12',
        costoUnitario: '250.5',
      }],
    });
  });

  it('rechaza cantidades no enteras, costos negativos y duplicados', () => {
    expect(initialInventoryContract.safeParse({
      ...base,
      inventario: [{ ...base.inventario[0], cantidad: '1.5' }],
    }).success).toBe(false);
    expect(initialInventoryContract.safeParse({
      ...base,
      inventario: [{ ...base.inventario[0], costoUnitario: '-1' }],
    }).success).toBe(false);
    expect(initialInventoryContract.safeParse({
      ...base,
      inventario: [base.inventario[0], base.inventario[0]],
    }).success).toBe(false);
  });

  it('exige que la fecha de cada existencia sea la fecha de corte común', () => {
    expect(initialInventoryContract.safeParse({
      ...base,
      inventario: [{ ...base.inventario[0], fechaCorte: '2026-11-09' }],
    }).success).toBe(false);
  });
});
