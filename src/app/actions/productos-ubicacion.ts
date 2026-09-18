'use server'

import { getProductosPorUbicacion as fetchProductosPorUbicacion } from '@/lib/api/productos-ubicacion'
import type { ProductoConStock } from '@/lib/api/productos-ubicacion'
import { handleServerActionError } from './_helpers/error-handler'

/**
 * @description Server Action que obtiene productos con stock disponible en una ubicación.
 * NO cachear por ubicacionId solo: con clienteId el payload incluye precios
 * de la lista del cliente; una caché compartida mezclaría precios entre clientes.
 *
 * @param ubicacionId - ID del punto de venta o almacén
 * @param clienteId - Opcional; en puntos de venta incluye los precios de la
 *   lista del cliente además de los del PV (LP-0).
 * @returns Lista de productos con stock > 0 en la ubicación
 * @throws {ServerActionError} si hay error de autenticación, la ubicación no existe, o error interno
 */
export async function getProductosPorUbicacion(
  ubicacionId: string,
  clienteId?: string
): Promise<ProductoConStock[]> {
  try {
    return await fetchProductosPorUbicacion(ubicacionId, clienteId)
  } catch (error) {
    handleServerActionError(error, 'getProductosPorUbicacion')
  }
}
