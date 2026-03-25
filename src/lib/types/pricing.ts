/**
 * @description Fuente del precio aplicado en flujos de ventas por punto de venta.
 */
export type PrecioFuente = 'LISTA' | 'BASE';

/**
 * @description Contrato mínimo para resolver precio efectivo en POS.
 */
export interface PrecioEfectivoLike {
  precioVenta: number;
  precioVentaResuelto?: number;
  precios?: Array<{ listaPrecioId: string; precio: number }>;
}

/**
 * @description Devuelve el precio efectivo para venta priorizando precio de cliente, luego de sucursal, luego base.
 * @param {PrecioEfectivoLike} producto - Producto con precio base y opcionalmente precio resuelto y array de precios.
 * @param {string | null} clienteListaPrecioId - ID de la lista de precios del cliente (opcional).
 * @returns {number} Precio efectivo a utilizar en cálculos de venta.
 */
export function getPrecioEfectivo(producto: PrecioEfectivoLike, clienteListaPrecioId?: string | null): number {
  if (clienteListaPrecioId && producto.precios && producto.precios.length > 0) {
    const precioCliente = producto.precios.find(p => p.listaPrecioId === clienteListaPrecioId);
    if (precioCliente) {
      return precioCliente.precio;
    }
  }

  if (producto.precioVentaResuelto !== undefined) {
    return producto.precioVentaResuelto;
  }

  return producto.precioVenta;
}
