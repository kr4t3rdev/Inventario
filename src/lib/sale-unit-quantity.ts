import {
  calculateUnitQuantityCost,
  type UnitQuantityCost,
  type UnitQuantityCostError,
} from '@/lib/unit-quantity-cost';

const FACTOR_SCALE = BigInt(100_000_000);
const PERSISTED_INT_MAX = BigInt(2_147_483_647);
const FACTOR_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,8})?$/;

export interface SaleUnitQuantityInput {
  sourceQuantity: number;
  sourceUnitPrice: number;
  factorToStock: string;
  expectedStockUnitPrice: number;
}

export type SaleUnitQuantityResult =
  | { success: true; data: UnitQuantityCost }
  | { success: false; error: UnitQuantityCostError | 'UNIT_PRICE_MISMATCH' };

export interface SourceUnitPriceInput {
  stockUnitPrice: number;
  factorToStock: string;
}

export type SourceUnitPriceResult =
  | { success: true; data: number }
  | { success: false; error: 'INVALID_INPUT' | 'INVALID_FACTOR' | 'FRACTIONAL_SOURCE_UNIT_PRICE' | 'INTEGER_OVERFLOW' };

/**
 * @description Convierte una venta desde la unidad elegida a la unidad base y valida el precio
 * contra el precio vigente del producto expresado en unidad base.
 * @param {SaleUnitQuantityInput} input - Cantidad/precio origen, factor y precio base vigente.
 * @returns {SaleUnitQuantityResult} Valores normalizados para persistencia/FIFO o error de validación.
 */
export function calculateSaleUnitQuantity(input: SaleUnitQuantityInput): SaleUnitQuantityResult {
  if (!Number.isSafeInteger(input.expectedStockUnitPrice) || input.expectedStockUnitPrice < 0) {
    return { success: false, error: 'INVALID_INPUT' };
  }

  const converted = calculateUnitQuantityCost({
    sourceQuantity: input.sourceQuantity,
    sourceUnitPrice: input.sourceUnitPrice,
    factorToStock: input.factorToStock,
  });
  if (!converted.success) return converted;
  if (converted.data.stockUnitPrice !== input.expectedStockUnitPrice) {
    return { success: false, error: 'UNIT_PRICE_MISMATCH' };
  }

  return converted;
}

/**
 * @description Calcula el precio de una unidad de venta a partir del precio base y su factor.
 * @param {SourceUnitPriceInput} input - Precio en stock y unidades base por unidad origen.
 * @returns {SourceUnitPriceResult} Precio origen exacto, sin redondeo, o error.
 */
export function calculateSourceUnitPrice(input: SourceUnitPriceInput): SourceUnitPriceResult {
  if (!Number.isSafeInteger(input.stockUnitPrice) || input.stockUnitPrice < 0) {
    return { success: false, error: 'INVALID_INPUT' };
  }
  if (typeof input.factorToStock !== 'string' || !FACTOR_PATTERN.test(input.factorToStock)) {
    return { success: false, error: 'INVALID_FACTOR' };
  }

  const [whole, fraction = ''] = input.factorToStock.split('.');
  const factorAtoms = BigInt(whole) * FACTOR_SCALE + BigInt(fraction.padEnd(8, '0') || '0');
  if (factorAtoms <= BigInt(0)) return { success: false, error: 'INVALID_FACTOR' };

  const sourcePriceNumerator = BigInt(input.stockUnitPrice) * factorAtoms;
  if (sourcePriceNumerator % FACTOR_SCALE !== BigInt(0)) {
    return { success: false, error: 'FRACTIONAL_SOURCE_UNIT_PRICE' };
  }
  const sourcePrice = sourcePriceNumerator / FACTOR_SCALE;
  if (sourcePrice > PERSISTED_INT_MAX) return { success: false, error: 'INTEGER_OVERFLOW' };

  return { success: true, data: Number(sourcePrice) };
}
