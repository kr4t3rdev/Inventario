import { describe, expect, it } from 'vitest';
import { decidirNormalizacionStockPv } from './normalizar-stock-pv-duplicado';

describe('decidirNormalizacionStockPv', () => {
  it('pone a cero el PV cuando el duplicado está intacto desde la creación', () => {
    expect(
      decidirNormalizacionStockPv({
        stockProducto: 10,
        almacenCantidad: 10,
        pvCantidad: 10,
        pvReservada: 0,
      }),
    ).toBe('zero-pv');
  });

  it('requiere revisión manual cuando el PV tuvo movimientos (ventas drenaron el PV)', () => {
    expect(
      decidirNormalizacionStockPv({
        stockProducto: 10,
        almacenCantidad: 10,
        pvCantidad: 6, // se vendió desde el PV
        pvReservada: 0,
      }),
    ).toBe('manual-review');
  });

  it('requiere revisión manual cuando el almacén diverge del stock inicial (transferencias)', () => {
    expect(
      decidirNormalizacionStockPv({
        stockProducto: 10,
        almacenCantidad: 6,
        pvCantidad: 14, // hubo transferencia almacén→PV
        pvReservada: 0,
      }),
    ).toBe('manual-review');
  });

  it('requiere revisión manual cuando hay stock reservado en el PV', () => {
    expect(
      decidirNormalizacionStockPv({
        stockProducto: 10,
        almacenCantidad: 10,
        pvCantidad: 10,
        pvReservada: 2,
      }),
    ).toBe('manual-review');
  });

  it('no hace nada si no existe fila de punto de venta', () => {
    expect(
      decidirNormalizacionStockPv({
        stockProducto: 10,
        almacenCantidad: 10,
        pvCantidad: null,
        pvReservada: 0,
      }),
    ).toBe('no-pv-row');
  });

  it('marca falta de almacén como caso inesperado de revisión', () => {
    expect(
      decidirNormalizacionStockPv({
        stockProducto: 10,
        almacenCantidad: null,
        pvCantidad: 10,
        pvReservada: 0,
      }),
    ).toBe('no-almacen-row');
  });
});
