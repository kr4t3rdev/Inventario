'use server'

import { withAction, ActionError } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import { requireFeature } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { requireFichaCostoFeature } from './lib/require-feature'
import type { PrecioEnListaResult, GetListasPreciosProductoInput } from './types'

/**
 * @description Devuelve los precios del producto en cada lista de precios
 *   del tenant. Útil para mostrar en la ficha de costo.
 */
export const getListasPreciosProductoAction = withAction(
  async (
    input: GetListasPreciosProductoInput,
    user: AuthenticatedUser,
  ): Promise<PrecioEnListaResult[]> => {
    const tenantId = requireFichaCostoFeature(user, 'ficha-costo')
    requireFeature(user, 'productos', 'ver listas de precios')

    const producto = await prisma.producto.findFirst({
      where: { id: input.productoId, tenantId },
      select: { id: true },
    })
    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND')
    }

    const precios = await prisma.precioProducto.findMany({
      where: { productoId: input.productoId, listaPrecio: { tenantId } },
      select: {
        precio: true,
        listaPrecio: { select: { id: true, nombre: true } },
      },
      orderBy: { listaPrecio: { nombre: 'asc' } },
    })

    return precios.map((p) => ({
      lista: p.listaPrecio,
      precio: p.precio,
    }))
  },
)
