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

export interface DetalleCostoVenta {
  historical: number;
  estimated: number;
  overAllocatedCost: number;
}

/**
 * @description Separa el costo FIFO histórico del fallback basado en el costo actual.
 * @param {VentaParaCosto} venta - Venta con items y asignaciones de compras.
 * @returns {DetalleCostoVenta} Costo histórico verificable y costo estimado.
 */
export function calcularDetalleCostoVenta(venta: VentaParaCosto): DetalleCostoVenta {
  if (!venta.items || venta.items.length === 0) {
    return {
      historical: 0,
      estimated: (venta.producto?.precioCosto ?? 0) * venta.cantidad,
      overAllocatedCost: 0,
    };
  }

  return venta.items.reduce<DetalleCostoVenta>((detail, item) => {
    const allocations = item.allocations ?? [];
    let remainingQuantity = item.cantidad;
    let historical = 0;
    let overAllocatedCost = 0;
    for (const allocation of allocations) {
      const usedQuantity = Math.min(Math.max(allocation.cantidad, 0), remainingQuantity);
      const excessQuantity = Math.max(0, allocation.cantidad - usedQuantity);
      const unitCost = allocation.compraDocumentoItem?.precioUnitario ?? 0;
      historical += usedQuantity * unitCost;
      overAllocatedCost += excessQuantity * unitCost;
      remainingQuantity -= usedQuantity;
    }

    return {
      historical: detail.historical + historical,
      estimated: detail.estimated + remainingQuantity * (item.producto?.precioCosto ?? 0),
      overAllocatedCost: detail.overAllocatedCost + overAllocatedCost,
    };
  }, { historical: 0, estimated: 0, overAllocatedCost: 0 });
}

/**
 * @description Suma el costo histórico de venta para un conjunto de ventas.
 *   Usa FIFO allocations cuando existen; cae a `precioCosto` actual como fallback.
 * @param {VentaParaCosto[]} ventas - Ventas con sus items, allocations y precios actuales.
 * @returns {number} Costo total de venta acumulado.
 */
export function calcularCostoVenta(ventas: VentaParaCosto[]): number {
  return ventas.reduce((total, venta) => {
    const detail = calcularDetalleCostoVenta(venta);
    return total + detail.historical + detail.estimated;
  }, 0);
}
