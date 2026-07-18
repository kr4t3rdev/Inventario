'use server'

import { revalidatePath } from 'next/cache'
import { withAction, ActionError } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import {
  requireFeature,
  requireManagerRole,
} from '@/lib/services/tenant-scope'
import { recordCostChange, CostChangeReason } from '@/lib/cost-history-utils'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { requireFichaCostoFeature } from './lib/require-feature'
import { validateInput } from './lib/input-validation'
import { z } from 'zod'
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
    const parsed = validateInput(z.object({ search: z.string().max(200).optional(), limit: z.number().finite().int().min(1).max(500).optional() }), input)
    const tenantId = requireFichaCostoFeature(user, 'ficha-costo')
    const search = parsed.search?.trim()
    const canViewProductos = user.planFeatures?.productos === true
    const canViewServicios = user.planFeatures?.servicios === true

    if (!canViewProductos && !canViewServicios) {
      throw new ActionError('No tiene acceso a ficha de costo', 'FORBIDDEN')
    }

    const take = parsed.limit ?? 500
    const [productos, servicios] = await Promise.all([
      canViewProductos
        ? prisma.producto.findMany({
            where: {
              tenantId,
              ...(search
                ? {
                    OR: [
                      { nombre: { contains: search, mode: 'insensitive' } },
                      { codigoInterno: { contains: search, mode: 'insensitive' } },
                      { codigoNegocio: { contains: search, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            select: {
              id: true,
              nombre: true,
              codigoInterno: true,
              precioCosto: true,
              precioVenta: true,
              esCompuesto: true,
            },
            orderBy: { nombre: 'asc' },
            take,
          })
        : Promise.resolve([]),
      canViewServicios
        ? prisma.servicios.findMany({
            where: {
              tenantId,
              ...(search
                ? { nombre: { contains: search, mode: 'insensitive' } }
                : {}),
            },
            select: {
              servicioId: true,
              nombre: true,
              precio: true,
            },
            orderBy: { nombre: 'asc' },
            take,
          })
        : Promise.resolve([]),
    ])

    return [
      ...productos.map((p) => ({
        id: p.id,
        entityType: 'PRODUCTO' as const,
        nombre: p.nombre,
        codigoInterno: p.codigoInterno,
        precioCosto: p.precioCosto,
        precioVenta: p.precioVenta,
        tipo: p.esCompuesto ? 'COMPUESTO' : 'SIMPLE',
      })),
      ...servicios.map((s) => ({
        id: s.servicioId,
        entityType: 'SERVICIO' as const,
        nombre: s.nombre,
        codigoInterno: null,
        precioCosto: 0,
        precioVenta: s.precio,
        tipo: 'SERVICIO' as const,
      })),
    ].sort((left, right) => left.nombre.localeCompare(right.nombre))
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
    const tenantId = requireFichaCostoFeature(user, 'ficha-costo')
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

    if (producto.precioCosto === input.precioCosto) {
      return { id: producto.id, precioCosto: producto.precioCosto }
    }

    const actualizado = await prisma.$transaction(async (tx) => {
      const result = await tx.producto.updateMany({
        where: {
          id: input.productoId,
          tenantId,
          precioCosto: producto.precioCosto,
        },
        data: { precioCosto: input.precioCosto },
      })
      if (result.count !== 1) {
        throw new ActionError('El producto fue modificado. Recargá e intentá nuevamente', 'CONFLICT')
      }

      await recordCostChange(tx, {
        productoId: producto.id,
        oldPrecioCosto: producto.precioCosto,
        newPrecioCosto: input.precioCosto,
        oldPrecioVenta: producto.precioVenta,
        newPrecioVenta: producto.precioVenta,
        reason: CostChangeReason.MANUAL_EDIT,
        changedBy: user.userId || 'system',
        notes: input.notes ?? 'Edición manual desde ficha de costo',
      })

      return { id: producto.id, precioCosto: input.precioCosto }
    })

    revalidatePath(`/busy/ficha-costo/${input.productoId}`)
    revalidatePath('/busy/ficha-costo')

    return actualizado
  },
)
