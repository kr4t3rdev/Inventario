/**
 * @description Resolver unificado del precio de venta (LP-0). Función pura
 *   compartida por la creación de ventas (server-side) y la UI.
 *   Cadena de prioridad: lista del cliente > lista del punto de venta > precio base.
 *   Los precios son enteros y ya vienen persistidos; no hay redondeos aquí.
 * @module features/ventas/services/precio-venta-resolver
 */

/** Fuente de la que salió el precio aplicado. */
export type PrecioVentaFuente = 'CLIENTE' | 'PV' | 'BASE';

/** Entrada de precio por lista tal como la devuelve Prisma (`PrecioProducto`). */
export interface PrecioListaEntrada {
	listaPrecioId: string;
	precio: number;
}

export interface ResolvePrecioVentaInput {
	/** `Producto.precioVenta` — último recurso cuando ninguna lista aplica. */
	precioBase: number;
	/** Precios por lista del producto (puede venir filtrado a las listas relevantes). */
	precios: PrecioListaEntrada[];
	/** Lista de precios asignada al punto de venta (null si no tiene). */
	pvListaId: string | null;
	/** Lista de precios asignada al cliente (null si no tiene o no hay cliente). */
	clienteListaId: string | null;
}

export interface PrecioVentaResuelto {
	precio: number;
	fuente: PrecioVentaFuente;
}

/**
 * @description Resuelve el precio efectivo de un ítem de venta.
 * @param {ResolvePrecioVentaInput} input - Precio base, precios por lista y listas aplicables.
 * @returns {PrecioVentaResuelto} Precio resultante y su fuente.
 */
export function resolvePrecioVenta(input: ResolvePrecioVentaInput): PrecioVentaResuelto {
	const { precioBase, precios, pvListaId, clienteListaId } = input;

	if (clienteListaId) {
		const entrada = precios.find((p) => p.listaPrecioId === clienteListaId);
		if (entrada) return { precio: entrada.precio, fuente: 'CLIENTE' };
	}

	if (pvListaId) {
		const entrada = precios.find((p) => p.listaPrecioId === pvListaId);
		if (entrada) return { precio: entrada.precio, fuente: 'PV' };
	}

	return { precio: precioBase, fuente: 'BASE' };
}
