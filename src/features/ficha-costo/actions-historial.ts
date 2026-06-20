'use server'

import { withAction, ActionError } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import { requireTenant, requireFeature } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import type { HistorialCostosData, GetHistorialCostosInput } from './types'

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
    const tenantId = requireTenant(user)
    requireFeature(user, 'productos', 'ver el historial de costos')

    const producto = await prisma.producto.findFirst({
      where: { id: input.productoId, tenantId },
      select: { id: true },
    })
    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND')
    }

    const page = input.page && input.page > 0 ? input.page : 1
    const limit =
      input.limit && input.limit > 0 && input.limit <= 100 ? input.limit : HISTORIAL_DEFAULT_LIMIT
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      productoId: input.productoId,
      tenantId,
    }
    const docWhere: Record<string, unknown> = { deletedAt: null }
    if (input.fechaDesde) {
      docWhere.fechaCompra = { ...((docWhere.fechaCompra as object) ?? {}), gte: new Date(input.fechaDesde) }
    }
    if (input.fechaHasta) {
      docWhere.fechaCompra = { ...((docWhere.fechaCompra as object) ?? {}), lte: new Date(input.fechaHasta) }
    }
    if (input.proveedorId) {
      docWhere.proveedorId = input.proveedorId
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
