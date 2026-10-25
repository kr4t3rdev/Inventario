export type InventoryUnitDimension =
  | 'COUNT'
  | 'MASS'
  | 'VOLUME'
  | 'LENGTH'
  | 'AREA'
  | 'UNKNOWN';

export interface InventoryUnitConversionContext {
  tenantId: string;
  productId: string;
  stockUnitId: string;
  stockUnitDimension: InventoryUnitDimension;
  sourceTenantId: string;
  sourceUnitId: string;
  sourceUnitDimension: InventoryUnitDimension;
  conversionTenantId: string;
  conversionProductId: string;
  conversionStockUnitId: string;
  factorToStock: string;
}

/**
 * @description Verifica que una conversión pertenezca al producto, tenant y unidad base actuales.
 * @param {InventoryUnitConversionContext} context - Contexto de unidades y conversión.
 * @returns {boolean} Indica si la conversión puede usarse sin cruzar dimensiones.
 */
export function isCompatibleUnitConversion(
  context: InventoryUnitConversionContext,
): boolean {
  const factorIsDecimal = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,8})?$/.test(context.factorToStock);
  const factor = factorIsDecimal ? Number(context.factorToStock) : Number.NaN;
  const legacyIdentity =
    context.stockUnitDimension === 'UNKNOWN' &&
    context.sourceUnitDimension === 'UNKNOWN' &&
    context.stockUnitId === context.sourceUnitId &&
    context.factorToStock === '1';
  const knownCompatibleDimensions =
    context.stockUnitDimension !== 'UNKNOWN' &&
    context.sourceUnitDimension !== 'UNKNOWN' &&
    context.stockUnitDimension === context.sourceUnitDimension;
  const sameUnitFactorIsIdentity =
    context.sourceUnitId !== context.stockUnitId || context.factorToStock === '1';

  return (
    context.tenantId === context.conversionTenantId &&
    context.productId === context.conversionProductId &&
    context.tenantId === context.sourceTenantId &&
    context.stockUnitId === context.conversionStockUnitId &&
    sameUnitFactorIsIdentity &&
    (legacyIdentity || knownCompatibleDimensions) &&
    Number.isFinite(factor) &&
    factor > 0
  );
}
