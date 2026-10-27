/** @description Builds line payloads without changing the legacy/base-unit purchase contract. */
export function buildPurchaseUnitPayload<T extends { productoId: string; unidadId?: string }>(
  items: T[],
  productBaseUnits: Map<string, string | null | undefined>,
  isDirectPurchase: boolean,
): Array<T & { unidadId: string | undefined }> {
  return items.map((item) => {
    const selectedUnit = item.unidadId;
    const isAlternateDirectUnit = isDirectPurchase && selectedUnit && selectedUnit !== productBaseUnits.get(item.productoId);
    const { unidadId: _ignoredUnitId, ...legacyItem } = item;
    return isAlternateDirectUnit ? { ...legacyItem, unidadId: selectedUnit } : legacyItem;
  }) as Array<T & { unidadId: string | undefined }>;
}
