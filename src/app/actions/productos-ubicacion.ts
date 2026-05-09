'use server'

import { getProductosPorUbicacion as fetchProductosPorUbicacion } from '@/lib/api/productos-ubicacion'
import { handleServerActionError } from './_helpers/error-handler'
import type { ProductoConStock } from '@/lib/redux/services/productosUbicacionApi'

/**
 * @description Server Action que obtiene productos con stock disponible en una ubicación.
 * Cachea con tag 'ProductosUbicacion' para revalidación automática.
 *
 * @param ubicacionId - ID del punto de venta o almacén
 * @returns Lista de productos con stock > 0 en la ubicación
 * @throws {ServerActionError} si hay error de autenticación, la ubicación no existe, o error interno
 */
export async function getProductosPorUbicacion(
  ubicacionId: string
): Promise<ProductoConStock[]> {
  try {
    return await fetchProductosPorUbicacion(ubicacionId)
  } catch (error) {
    handleServerActionError(error, 'getProductosPorUbicacion')
  }
}
