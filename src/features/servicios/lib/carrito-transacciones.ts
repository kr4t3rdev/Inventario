/**
 * @description Transforma el carrito de servicios en payload(s) para compra/venta.
 * @module @/features/servicios/lib/carrito-transacciones
 */

const MONEDA_DEFAULT = 'CUP';

export type CartMode = 'VENTA' | 'COMPRA';

export interface ItemCarritoTx {
  servicioId: string;
  precio: number;
  costo: number;
  cantidad: number;
  moneda?: string;
}

export interface VentaPayload {
  lineas: Array<{
    tipoLinea: 'SERVICIO';
    servicioId: string;
    cantidad: number;
    precioUnitario: number;
    costo: number;
  }>;
  clienteId?: string | null;
  observaciones?: string | null;
}

export interface CompraPayload {
  servicioId: string;
  cantidad: number;
  costoUnitario: number;
  proveedorId: string | null;
  numeroFactura?: string | null;
  formaPago: 'PAGO_COMPLETO' | 'PAGO_PARCIAL';
  estado: 'PAGADA' | 'PENDIENTE';
  descripcion?: string | null;
  anticipos?: Array<{ anticipoId: string; montoAplicado: number }>;
}

const itemServicioToLinea = (item: ItemCarritoTx) => ({
  tipoLinea: 'SERVICIO' as const,
  servicioId: item.servicioId,
  cantidad: item.cantidad,
  precioUnitario: item.precio,
  costo: item.costo,
});

/**
 * @description Construye el payload de venta (batch de líneas de servicio) desde el carrito.
 * @param {ItemCarritoTx[]} items
 * @param {{ clienteId?: string | null; observaciones?: string | null }} meta
 * @returns {VentaPayload}
 */
export function buildVentaPayload(
  items: ItemCarritoTx[],
  meta: { clienteId?: string | null; observaciones?: string | null } = {},
): VentaPayload {
  return {
    lineas: items.map(itemServicioToLinea),
    clienteId: meta.clienteId ?? null,
    observaciones: meta.observaciones ?? null,
  };
}

/**
 * @description Construye el payload de compra (servicio recibido/egreso) desde el carrito.
 * El modo COMPRA genera una compra por línea del carrito: el backend crea por
 * línea (cada línea es un registro en CompraServicio).
 * @param {ItemCarritoTx} item
 * @param {Object} meta
 * @param {string|null} meta.proveedorId - Proveedor del servicio recibido.
 * @param {string|null} meta.numeroFactura - Número de factura (egreso).
 * @param {'PAGO_COMPLETO'|'PAGO_PARCIAL'} meta.formaPago
 * @param {'PAGADA'|'PENDIENTE'} meta.estado
 * @param {Object[]|undefined} meta.anticipos
 * @returns {CompraPayload}
 */
export function buildCompraPayload(
  item: ItemCarritoTx,
  meta: {
    proveedorId?: string | null;
    numeroFactura?: string | null;
    formaPago?: 'PAGO_COMPLETO' | 'PAGO_PARCIAL';
    estado?: 'PAGADA' | 'PENDIENTE';
    anticipos?: Array<{ anticipoId: string; montoAplicado: number }>;
  } = {},
): CompraPayload {
  return {
    servicioId: item.servicioId,
    cantidad: item.cantidad,
    costoUnitario: item.costo,
    proveedorId: meta.proveedorId ?? null,
    numeroFactura: meta.numeroFactura ?? null,
    formaPago: meta.formaPago ?? 'PAGO_COMPLETO',
    estado: meta.estado ?? 'PAGADA',
    descripcion: null,
    anticipos: meta.anticipos,
  };
}

/**
 * @description Resuelve el modo correcto según el carrito: VENTA si hay costos
 * distintos de cero y cliente set, COMPRA si el proveedorId está presente.
 * (El UI alterna entre los dos modos; la función marca el fallback para tests.)
 * @param {ItemCarritoTx[]} cart - Carrito actual
 * @param {Object} meta - Contexto del tab (proveedorId/compra o clienteId/venta)
 * @returns {CartMode}
 */
export function resolveCartMode(
  cart: ItemCarritoTx[],
  meta: { proveedorId?: string | null; clienteId?: string | null } = {},
): CartMode {
  if (meta.proveedorId) return 'COMPRA';
  return 'VENTA';
}

/**
 * @description Verifica si un carrito en modo compra tiene totales uniformes
 * en una sola moneda (regla del servidor: compras se escriben en una sola
 * moneda por transacción).
 * @param {ItemCarritoTx[]} cart
 * @returns {boolean}
 */
export function esCarritoCompraUniforme(cart: ItemCarritoTx[]): boolean {
  if (cart.length === 0) return true;
  const first = (cart[0].moneda ?? MONEDA_DEFAULT).trim().toUpperCase();
  return cart.every((i) => (i.moneda ?? MONEDA_DEFAULT).trim().toUpperCase() === first);
}
