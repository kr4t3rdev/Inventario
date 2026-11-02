import { describe, expect, it } from 'vitest';

import { calculateSaleUnitQuantity, calculateSourceUnitPrice } from './sale-unit-quantity';

describe('calculateSaleUnitQuantity', () => {
  it('normaliza dos cajas de doce a 24 unidades base y valida el precio base', () => {
    expect(calculateSaleUnitQuantity({
      sourceQuantity: 2,
      sourceUnitPrice: 6000,
      factorToStock: '12',
      expectedStockUnitPrice: 500,
    })).toEqual({
      success: true,
      data: { stockQuantity: 24, stockUnitPrice: 500, lineTotal: 12000 },
    });
  });

  it('rechaza un precio de unidad origen que no corresponde a la lista vigente', () => {
    expect(calculateSaleUnitQuantity({
      sourceQuantity: 2,
      sourceUnitPrice: 6000,
      factorToStock: '12',
      expectedStockUnitPrice: 499,
    })).toEqual({ success: false, error: 'UNIT_PRICE_MISMATCH' });
  });

  it('propaga los errores de conversión exacta', () => {
    expect(calculateSaleUnitQuantity({
      sourceQuantity: 1,
      sourceUnitPrice: 6000,
      factorToStock: '12',
      expectedStockUnitPrice: 500,
    })).toEqual({ success: true, data: { stockQuantity: 12, stockUnitPrice: 500, lineTotal: 6000 } });

    expect(calculateSaleUnitQuantity({
      sourceQuantity: 1,
      sourceUnitPrice: 100,
      factorToStock: '2.5',
      expectedStockUnitPrice: 40,
    })).toEqual({ success: false, error: 'FRACTIONAL_STOCK_QUANTITY' });
  });

  it('calcula el precio de venta de una unidad alternativa sin redondeos', () => {
    expect(calculateSourceUnitPrice({ stockUnitPrice: 500, factorToStock: '12' }))
      .toEqual({ success: true, data: 6000 });
    expect(calculateSourceUnitPrice({ stockUnitPrice: 101, factorToStock: '0.5' }))
      .toEqual({ success: false, error: 'FRACTIONAL_SOURCE_UNIT_PRICE' });
  });
});
