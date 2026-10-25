import { describe, expect, it } from 'vitest';
import { calculateUnitQuantityCost } from './unit-quantity-cost';

describe('calculateUnitQuantityCost', () => {
  it('converts source quantity and unit price while preserving the exact line total', () => {
    expect(calculateUnitQuantityCost({
      sourceQuantity: 2,
      sourceUnitPrice: 6000,
      factorToStock: '12',
    })).toEqual({
      success: true,
      data: { stockQuantity: 24, stockUnitPrice: 500, lineTotal: 12000 },
    });
  });

  it('preserves identity conversion', () => {
    expect(calculateUnitQuantityCost({
      sourceQuantity: 4,
      sourceUnitPrice: 125,
      factorToStock: '1.00000000',
    })).toEqual({
      success: true,
      data: { stockQuantity: 4, stockUnitPrice: 125, lineTotal: 500 },
    });
  });

  it('converts a half-unit factor exactly', () => {
    expect(calculateUnitQuantityCost({
      sourceQuantity: 2,
      sourceUnitPrice: 100,
      factorToStock: '0.5',
    })).toEqual({
      success: true,
      data: { stockQuantity: 1, stockUnitPrice: 200, lineTotal: 200 },
    });
  });

  it('converts a one-and-a-half-unit factor exactly', () => {
    expect(calculateUnitQuantityCost({
      sourceQuantity: 2,
      sourceUnitPrice: 300,
      factorToStock: '1.5',
    })).toEqual({
      success: true,
      data: { stockQuantity: 3, stockUnitPrice: 200, lineTotal: 600 },
    });
  });

  it('returns invalid input for a null runtime argument', () => {
    expect(calculateUnitQuantityCost(null as unknown as Parameters<typeof calculateUnitQuantityCost>[0]))
      .toEqual({ success: false, error: 'INVALID_INPUT' });
  });

  it('does not round a non-integral stock quantity', () => {
    expect(calculateUnitQuantityCost({
      sourceQuantity: 1,
      sourceUnitPrice: 2,
      factorToStock: '0.5',
    })).toEqual({ success: false, error: 'FRACTIONAL_STOCK_QUANTITY' });
  });

  it('does not round a non-integral stock-unit price', () => {
    expect(calculateUnitQuantityCost({
      sourceQuantity: 3,
      sourceUnitPrice: 100,
      factorToStock: '3',
    })).toEqual({ success: false, error: 'FRACTIONAL_STOCK_UNIT_PRICE' });
  });

  it.each([
    ['zero', '0'],
    ['negative', '-1'],
    ['too much scale', '0.000000001'],
    ['too many integer digits', '10000000000'],
    ['exponent notation', '1e2'],
    ['whitespace', ' 1'],
  ])('rejects an invalid factor (%s)', (_label, factorToStock) => {
    expect(calculateUnitQuantityCost({
      sourceQuantity: 1,
      sourceUnitPrice: 1,
      factorToStock,
    })).toEqual({ success: false, error: 'INVALID_FACTOR' });
  });

  it.each([
    [0, 1, '1'],
    [-0, 1, '1'],
    [1.5, 1, '1'],
    [2147483648, 1, '1'],
    [1, -0, '1'],
    [1, -1, '1'],
    [1, 1.25, '1'],
    [1, 2147483648, '1'],
    [Number.NaN, 1, '1'],
    [1, Number.POSITIVE_INFINITY, '1'],
  ])('rejects invalid persisted inputs (%s, %s)', (sourceQuantity, sourceUnitPrice, factorToStock) => {
    expect(calculateUnitQuantityCost({
      sourceQuantity,
      sourceUnitPrice,
      factorToStock,
    })).toEqual({ success: false, error: 'INVALID_INPUT' });
  });

  it('rejects converted values that exceed PostgreSQL Int bounds', () => {
    expect(calculateUnitQuantityCost({
      sourceQuantity: 2147483647,
      sourceUnitPrice: 2,
      factorToStock: '2',
    })).toEqual({ success: false, error: 'INTEGER_OVERFLOW' });
  });

  it('rejects a line total that exceeds PostgreSQL Int bounds', () => {
    expect(calculateUnitQuantityCost({
      sourceQuantity: 50000,
      sourceUnitPrice: 50000,
      factorToStock: '1',
    })).toEqual({ success: false, error: 'INTEGER_OVERFLOW' });
  });

  it('parses the maximum Decimal(18,8) factor without rounding a fractional result', () => {
    expect(calculateUnitQuantityCost({
      sourceQuantity: 1,
      sourceUnitPrice: 0,
      factorToStock: '9999999999.99999999',
    })).toEqual({ success: false, error: 'FRACTIONAL_STOCK_QUANTITY' });
  });

  it('accepts a minimum-scale factor when it produces exact persisted values', () => {
    expect(calculateUnitQuantityCost({
      sourceQuantity: 100000000,
      sourceUnitPrice: 0,
      factorToStock: '0.00000001',
    })).toEqual({
      success: true,
      data: { stockQuantity: 1, stockUnitPrice: 0, lineTotal: 0 },
    });
  });
});
