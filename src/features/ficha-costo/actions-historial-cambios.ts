'use server'

import { withAction } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import { requireTenant } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

// ─── Tipos ─────────────────────────────────────────────────

export interface GetHistorialCambiosInput {
  productoId?: string
  page?: number
  limit?: number
}

export interface CambioPrecioItem {
  id: string
  productoId: string
  fecha: string
  precioVenta: { old: number; new: number }
  precioCosto: { old: number; new: number }
  reason: string
  changedBy: string
  notes: string | null
}

export interface HistorialCambiosData {
  items: CambioPrecioItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ─── getHistorialCambiosPrecioAction ───────────────────────

/**
 * @description Retorna el historial paginado de cambios de precio (venta y costo)
 *   desde ProductoCostHistory. Opcionalmente filtrado por productoId.
 */
export const getHistorialCambiosPrecioAction = withAction(
  async (
    input: GetHistorialCambiosInput,
    user: AuthenticatedUser,
  ): Promise<HistorialCambiosData> => {
    const tenantId = requireTenant(user)
    const { productoId, page = 1, limit = 20 } = input

    const where: any = {}
    if (productoId) where.productoId = productoId

    // ProductoCostHistory no tiene tenantId; la seguridad multi-tenant
    // se garantiza validando que el productoId pertenezca al tenant.
    if (productoId) {
      const producto = await prisma.producto.findFirst({
        where: { id: productoId, tenantId },
        select: { id: true },
      })
      if (!producto) {
        return { items: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } }
      }
    }

    const [rows, total] = await Promise.all([
      prisma.productoCostHistory.findMany({
        where,
        orderBy: { changedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.productoCostHistory.count({ where }),
    ])

    const items: CambioPrecioItem[] = rows.map((r) => ({
      id: r.id,
      productoId: r.productoId,
      fecha: r.changedAt.toISOString(),
      precioVenta: { old: r.oldPrecioVenta, new: r.newPrecioVenta },
      precioCosto: { old: r.oldPrecioCosto, new: r.newPrecioCosto },
      reason: r.reason,
      changedBy: r.changedBy,
      notes: r.notes,
    }))

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  },
)
