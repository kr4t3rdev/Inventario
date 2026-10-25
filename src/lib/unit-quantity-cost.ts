const POSTGRES_INT_MAX = BigInt('2147483647');
const FACTOR_SCALE = BigInt('100000000');
const BIGINT_ZERO = BigInt('0');
const FACTOR_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,8})?$/;

/** Inputs from source-unit quantities and prices plus a Decimal(18,8) stock factor. */
export interface UnitQuantityCostInput {
  sourceQuantity: number;
  sourceUnitPrice: number;
  factorToStock: string;
}

/** Exact stock-unit values, representable by the current Prisma Int columns. */
export interface UnitQuantityCost {
  stockQuantity: number;
  stockUnitPrice: number;
  lineTotal: number;
}

/** Errors returned when exact conversion cannot fit the current persisted contract. */
export type UnitQuantityCostError =
  | 'INVALID_INPUT'
  | 'INVALID_FACTOR'
  | 'FRACTIONAL_STOCK_QUANTITY'
  | 'FRACTIONAL_STOCK_UNIT_PRICE'
  | 'INTEGER_OVERFLOW';

/** Result of exact unit conversion without applying a rounding policy. */
export type UnitQuantityCostResult =
  | { success: true; data: UnitQuantityCost }
  | { success: false; error: UnitQuantityCostError };

/**
 * @description Converts quantity and unit price exactly to the product stock unit.
 * @param {UnitQuantityCostInput} input - Source values and stock-units-per-source-unit factor.
 * @returns {UnitQuantityCostResult} Exact converted values or a representability error.
 *
 * The caller must independently validate tenant/product/unit compatibility. This helper performs
 * arithmetic only and does not replace the persisted conversion compatibility validator.
 */
export function calculateUnitQuantityCost(
  input: UnitQuantityCostInput
): UnitQuantityCostResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { success: false, error: 'INVALID_INPUT' };
  }

  const { sourceQuantity, sourceUnitPrice, factorToStock } = input;

  if (
    !isPersistedInt(sourceQuantity) ||
    sourceQuantity <= 0 ||
    !isPersistedInt(sourceUnitPrice) ||
    sourceUnitPrice < 0 ||
    Object.is(sourceUnitPrice, -0)
  ) {
    return { success: false, error: 'INVALID_INPUT' };
  }

  const factorAtoms = parseFactorAtoms(factorToStock);
  if (factorAtoms === null || factorAtoms <= BIGINT_ZERO) {
    return { success: false, error: 'INVALID_FACTOR' };
  }

  const quantityNumerator = BigInt(sourceQuantity) * factorAtoms;
  if (quantityNumerator % FACTOR_SCALE !== BIGINT_ZERO) {
    return { success: false, error: 'FRACTIONAL_STOCK_QUANTITY' };
  }

  const priceNumerator = BigInt(sourceUnitPrice) * FACTOR_SCALE;
  if (priceNumerator % factorAtoms !== BIGINT_ZERO) {
    return { success: false, error: 'FRACTIONAL_STOCK_UNIT_PRICE' };
  }

  const stockQuantity = quantityNumerator / FACTOR_SCALE;
  const stockUnitPrice = priceNumerator / factorAtoms;
  const lineTotal = BigInt(sourceQuantity) * BigInt(sourceUnitPrice);

  if (
    stockQuantity > POSTGRES_INT_MAX ||
    stockUnitPrice > POSTGRES_INT_MAX ||
    lineTotal > POSTGRES_INT_MAX
  ) {
    return { success: false, error: 'INTEGER_OVERFLOW' };
  }

  return {
    success: true,
    data: {
      stockQuantity: Number(stockQuantity),
      stockUnitPrice: Number(stockUnitPrice),
      lineTotal: Number(lineTotal),
    },
  };
}

/**
 * @description Checks whether a numeric value is a positive-or-zero PostgreSQL Int32 input.
 * @param {number} value - Value to validate.
 * @returns {boolean} Whether the value is an integer in the PostgreSQL Int32 range.
 */
function isPersistedInt(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= Number(POSTGRES_INT_MAX);
}

/**
 * @description Parses a positive Decimal(18,8) string into its exact 1e-8-scaled integer.
 * @param {string} value - Plain decimal text; exponent and locale formats are rejected.
 * @returns {bigint | null} Exact scaled value, or null when syntax/precision exceeds the schema.
 */
function parseFactorAtoms(value: string): bigint | null {
  if (typeof value !== 'string' || !FACTOR_PATTERN.test(value)) {
    return null;
  }

  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * FACTOR_SCALE + BigInt(fraction.padEnd(8, '0') || '0');
}
