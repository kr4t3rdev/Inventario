'use server'

import { withAction, ActionError } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import { requireTenant, requireFeature } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import type { HistorialCostosData, GetHistorialCostosInput } from './types'
import { validateInput, paginationShape, dateFiltersShape } from './lib/input-validation'
import { z } from 'zod'

const HISTORIAL_DEFAULT_LIMIT = 20

/**
 * @description Devuelve el historial paginado de líneas de compra del producto
 *   con su proveedor, número de factura, fecha, cantidad y precios.
 *   Filtros opcionales por rango de fechas y proveedor. Límite por defecto: 20.
 *   Excluye documentos soft-deleted (deletedAt: null) para alinearse con
 *   el cálculo del CPP.
 */
export const getHistorialCostosAction = withAction(
  async (
    input: GetHistorialCostosInput,
    user: AuthenticatedUser,
  ): Promise<HistorialCostosData> => {
    const parsed = validateInput(z.object({ productoId: z.string().min(1) }).extend(paginationShape).extend(dateFiltersShape).extend({ proveedorId: z.string().min(1).optional() }), input)
    const tenantId = requireTenant(user)
    requireFeature(user, 'productos', 'ver el historial de costos')

    const producto = await prisma.producto.findFirst({
      where: { id: parsed.productoId, tenantId },
      select: { id: true },
    })
    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND')
    }

    const page = parsed.page && parsed.page > 0 ? parsed.page : 1
    const limit =
      parsed.limit && parsed.limit > 0 && parsed.limit <= 100 ? parsed.limit : HISTORIAL_DEFAULT_LIMIT
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      productoId: parsed.productoId,
      tenantId,
    }
    const docWhere: Record<string, unknown> = { deletedAt: null }
    if (parsed.fechaDesde) {
      docWhere.fechaCompra = { ...((docWhere.fechaCompra as object) ?? {}), gte: new Date(parsed.fechaDesde) }
    }
    if (parsed.fechaHasta) {
      docWhere.fechaCompra = { ...((docWhere.fechaCompra as object) ?? {}), lte: new Date(parsed.fechaHasta) }
    }
    if (parsed.proveedorId) {
      docWhere.proveedorId = parsed.proveedorId
    }
    if (Object.keys(docWhere).length > 0) {
      where.compraDocumento = docWhere
    }

    const [items, total] = await Promise.all([
      prisma.compraDocumentoItem.findMany({
        where,
        orderBy: { compraDocumento: { fechaCompra: 'desc' } },
        skip,
        take: limit,
        select: {
          compraDocumentoItemId: true,
          cantidad: true,
          precioUnitario: true,
          totalLinea: true,
          compraDocumento: {
            select: {
              fechaCompra: true,
              numeroFactura: true,
              proveedorId: true,
              proveedor: { select: { nombre: true } },
            },
          },
        },
      }),
      prisma.compraDocumentoItem.count({ where }),
    ])

    return {
      items: items.map((it) => ({
        compraDocumentoItemId: it.compraDocumentoItemId,
        fecha: it.compraDocumento.fechaCompra.toISOString(),
        numeroFactura: it.compraDocumento.numeroFactura || '',
        proveedor: it.compraDocumento.proveedor.nombre,
        proveedorId: it.compraDocumento.proveedorId,
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
        totalLinea: it.totalLinea,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    }
  },
)
