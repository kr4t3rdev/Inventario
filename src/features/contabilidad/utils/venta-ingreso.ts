/**
 * @description Tipos y cálculo del ingreso histórico de venta para el Estado de Resultados.
 *
 *   El ingreso debe reflejar el monto REAL registrado al momento de la venta,
 *   no recalcularse con precios actuales (que pueden haber cambiado).
 *
 *   Estrategia de fuentes, en orden de prioridad:
 *   1. `sum(venta.items.total)` — fuente más confiable: cada `VentaItem.total`
 *      es `Int` (no-null) y se persiste al crear la venta.
 *   2. `venta.total` — para ventas legacy SIN items. Puede ser `null` (dato faltante);
 *      en ese caso se devuelve 0 (mejor sub-registrar que inventar con precio actual).
 *
 *   Lo que YA NO se hace: el fallback anterior `v.total ?? producto.precioVenta * v.cantidad`
 *   recalculaba con el precio actual, distorsionando los ingresos históricos.
 * @module contabilidad/utils/venta-ingreso
 */

export interface VentaItemParaIngreso {
  id: string;
  total: number;
}

export interface VentaParaIngreso {
  ventaId: string;
  /** Total legacy a nivel de venta. Usado solo si NO hay `items`. */
  total: number | null;
  items: VentaItemParaIngreso[];
}

/**
 * @description Suma los ingresos históricos de venta para un conjunto de ventas.
 *   Prioriza `sum(items.total)` sobre `venta.total` para evitar distorsión por precios actuales.
 * @param {VentaParaIngreso[]} ventas - Ventas con sus items y totales.
 * @returns {number} Ingreso total acumulado.
 */
export function calcularIngresoVenta(ventas: VentaParaIngreso[]): number {
  return ventas.reduce((acc, v) => {
    if (v.items && v.items.length > 0) {
      return acc + v.items.reduce((s, i) => s + i.total, 0);
    }
    return acc + (v.total ?? 0);
  }, 0);
}
