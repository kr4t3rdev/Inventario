import { resolvePrecioVenta } from '@/features/ventas/services/precio-venta-resolver';

/**
 * @description Fuente del precio aplicado en flujos de ventas por punto de venta.
 */
export type PrecioFuente = 'LISTA' | 'BASE';

/**
 * @description Contrato mínimo para resolver precio efectivo en POS. Los ids
 * de lista (PV aplicada y default del tenant) viajan en el payload de
 * getProductosPorUbicacion desde LP-1.2.
 */
export interface PrecioEfectivoLike {
  precioVenta: number;
  listaPrecioIdAplicada?: string | null;
  listaPrecioDefaultId?: string | null;
  precios?: Array<{ listaPrecioId: string; precio: number }>;
}

/**
 * @description Devuelve el precio efectivo para venta delegando en el
 * resolver compartido con la cadena cliente > lista del PV > lista default
 * del tenant > base. Es solo wiring: la regla vive en resolvePrecioVenta,
 * única implementación, idéntica a la que valida el servidor al crear la
 * venta (LP-1.3 elimina la resolución duplicada).
 * @param {PrecioEfectivoLike} producto - Producto con precio base, ids de
 * lista aplicables y array de precios por lista.
 * @param {string | null} clienteListaPrecioId - ID de la lista de precios del cliente (opcional).
 * @returns {number} Precio efectivo a utilizar en cálculos de venta.
 */
export function getPrecioEfectivo(producto: PrecioEfectivoLike, clienteListaPrecioId?: string | null): number {
  return resolvePrecioVenta({
    precioBase: producto.precioVenta,
    precios: producto.precios ?? [],
    pvListaId: producto.listaPrecioIdAplicada ?? null,
    clienteListaId: clienteListaPrecioId ?? null,
    defaultListaId: producto.listaPrecioDefaultId ?? null,
  }).precio;
}
