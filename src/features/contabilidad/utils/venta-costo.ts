/**
 * @description Tipos y cálculo del costo histórico de venta para el Estado de Resultados.
 *
 *   El costo de venta debe reflejar el costo REAL al momento de la venta, no
 *   el `producto.precioCosto` actual (que puede haber cambiado desde entonces).
 *
 *   El sistema registra la trazabilidad real vía `PurchaseAllocation` (FIFO):
 *   cada `VentaItem` se vincula con su(s) `CompraDocumentoItem` original(es),
 *   y `CompraDocumentoItem.precioUnitario` es el costo histórico de esa compra.
 *
 *   Comportamiento:
 *   - Si el `VentaItem` tiene allocations → usar `cantidad * precioUnitario` de cada compra.
 *   - Si NO tiene allocations (legacy, sin compras registradas, o quantity no cubierta)
 *     → fallback a `producto.precioCosto` actual multiplicado por la cantidad restante.
 *   - Si la venta es legacy (sin `items`) → usar `producto.precioCosto * venta.cantidad`.
 * @module contabilidad/utils/venta-costo
 */

export interface AllocationParaCosto {
  id: string;
  cantidad: number;
  compraDocumentoItem: { precioUnitario: number } | null;
}

export interface VentaItemParaCosto {
  id: string;
  cantidad: number;
  producto: { precioCosto: number } | null;
  allocations: AllocationParaCosto[];
}

export interface VentaParaCosto {
  ventaId: string;
  /** Cantidad legacy a nivel de venta (usada solo si NO hay `items`). */
  cantidad: number;
  producto: { precioCosto: number } | null;
  items: VentaItemParaCosto[];
}

/**
 * @description Suma el costo histórico de venta para un conjunto de ventas.
 *   Usa FIFO allocations cuando existen; cae a `precioCosto` actual como fallback.
 * @param {VentaParaCosto[]} ventas - Ventas con sus items, allocations y precios actuales.
 * @returns {number} Costo total de venta acumulado.
 */
export function calcularCostoVenta(ventas: VentaParaCosto[]): number {
  return ventas.reduce((acc, v) => {
    // Modelo nuevo: venta con VentaItems
    if (v.items && v.items.length > 0) {
      return (
        acc +
        v.items.reduce((itemAcc, item) => {
          const allocations = item.allocations ?? [];
          if (allocations.length > 0) {
            const allocatedQty = allocations.reduce((a, x) => a + x.cantidad, 0);
            const allocatedCost = allocations.reduce(
              (a, x) => a + x.cantidad * (x.compraDocumentoItem?.precioUnitario ?? 0),
              0,
            );
            // Si las allocations no cubren toda la cantidad, completar con precioCosto actual.
            const remaining = Math.max(0, item.cantidad - allocatedQty);
            const fallbackCost = remaining * (item.producto?.precioCosto ?? 0);
            return itemAcc + allocatedCost + fallbackCost;
          }
          // Item sin allocations → fallback a precioCosto actual
          return itemAcc + item.cantidad * (item.producto?.precioCosto ?? 0);
        }, 0)
      );
    }
    // Venta legacy: sin items, usar producto directo
    return acc + (v.producto?.precioCosto ?? 0) * v.cantidad;
  }, 0);
}
