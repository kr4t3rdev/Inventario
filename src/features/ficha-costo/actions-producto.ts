'use server'

import { revalidatePath } from 'next/cache'
import { withAction, ActionError } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import {
  requireTenant,
  requireFeature,
  requireManagerRole,
} from '@/lib/services/tenant-scope'
import { recordCostChange, CostChangeReason } from '@/lib/cost-history-utils'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import type {
  ProductoFichaListItem,
  ListarProductosParaFichaInput,
  UpdatePrecioCostoInput,
  UpdatePrecioCostoResult,
} from './types'

/**
 * @description Devuelve la lista de productos del tenant con un resumen
 *   mínimo (id, nombre, código, precios, tipo) para alimentar el
 *   selector de la página principal de Ficha de Costo.
 */
export const listarProductosParaFichaAction = withAction(
  async (
    input: ListarProductosParaFichaInput,
    user: AuthenticatedUser,
  ): Promise<ProductoFichaListItem[]> => {
    const tenantId = requireTenant(user)
    requireFeature(user, 'productos', 'ver la ficha de costo')

    const where: Record<string, unknown> = { tenantId }
    if (input.search && input.search.trim()) {
      const s = input.search.trim()
      where.OR = [
        { nombre: { contains: s, mode: 'insensitive' } },
        { codigoInterno: { contains: s, mode: 'insensitive' } },
        { codigoNegocio: { contains: s, mode: 'insensitive' } },
      ]
    }

    const productos = await prisma.producto.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        codigoInterno: true,
        precioCosto: true,
        precioVenta: true,
        esCompuesto: true,
      },
      orderBy: { nombre: 'asc' },
      take: input.limit ?? 500,
    })

    return productos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      codigoInterno: p.codigoInterno,
      precioCosto: p.precioCosto,
      precioVenta: p.precioVenta,
      tipo: p.esCompuesto ? 'COMPUESTO' : 'SIMPLE',
    }))
  },
)

/**
 * @description Actualiza el `precioCosto` de un producto dentro del tenant
 *   activo. Requiere rol de manager. Registra el cambio en
 *   `ProductoCostHistory` para auditoría.
 */
export const updatePrecioCostoAction = withAction(
  async (
    input: UpdatePrecioCostoInput,
    user: AuthenticatedUser,
  ): Promise<UpdatePrecioCostoResult> => {
    const tenantId = requireTenant(user)
    requireManagerRole(user, 'editar el precio de costo')
    requireFeature(user, 'productos', 'editar el precio de costo')

    if (!Number.isFinite(input.precioCosto) || input.precioCosto < 0) {
      throw new ActionError('El precio de costo debe ser un número >= 0', 'VALIDATION_ERROR')
    }

    const producto = await prisma.producto.findFirst({
      where: { id: input.productoId, tenantId },
      select: { id: true, precioCosto: true, precioVenta: true },
    })
    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND')
    }

    const actualizado = await prisma.producto.update({
      where: { id: input.productoId },
      data: { precioCosto: input.precioCosto },
      select: { id: true, precioCosto: true },
    })

    if (producto.precioCosto !== input.precioCosto) {
      try {
        await recordCostChange(prisma, {
          productoId: producto.id,
          oldPrecioCosto: producto.precioCosto,
          newPrecioCosto: input.precioCosto,
          oldPrecioVenta: producto.precioVenta,
          newPrecioVenta: producto.precioVenta,
          reason: CostChangeReason.MANUAL_EDIT,
          changedBy: user.userId || 'system',
          notes: input.notes ?? 'Edición manual desde ficha de costo',
        })
      } catch (err) {
        console.error('Error registrando cost history (no bloqueante):', err)
      }
    }

    revalidatePath(`/busy/ficha-costo/${input.productoId}`)
    revalidatePath('/busy/ficha-costo')

    return actualizado
  },
)
