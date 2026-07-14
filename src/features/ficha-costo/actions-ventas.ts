'use server'

import { withAction, ActionError } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import { requireTenant, requireFeature } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { validateInput, paginationShape, dateFiltersShape } from './lib/input-validation'
import { z } from 'zod'
import { Prisma } from '@/generated/prisma'
import type {
  VentasProductoData,
  VentaProductoItem,
  VentasProductoResumen,
  GetVentasProductoInput,
} from './types'

const VENTAS_DEFAULT_LIMIT = 20

interface CostoGlobalRow {
  costoTotal: number
}

/**
 * @description Calcula el costo real de una venta usando las allocations
 *   FIFO. Si no hay allocations (venta legacy), usa el precioCosto del
 *   producto como fallback.
 *
 *   @param ventaItemId - ID del VentaItem
 *   @param allocations - Array de PurchaseAllocation de ese VentaItem
 *   @param comprasMap - Map de compraDocumentoItemId → precioUnitario
 *   @param precioCostoFallback - precioCosto del producto (para legacy)
 *   @param cantidad - Cantidad vendida
 *   @returns { costoReal, esLegacy }
 */
function calcularCostoFifoItem(
  ventaItemId: string,
  allocations: Array<{ compraDocumentoItemId: string; cantidad: number }>,
  comprasMap: Map<string, number>,
  precioCostoFallback: number,
  cantidad: number,
): { costoReal: number; esLegacy: boolean } {
  if (allocations.length === 0) {
    // Venta legacy sin allocations FIFO
    return { costoReal: precioCostoFallback * cantidad, esLegacy: true }
  }

  // Sumar costo de todas las allocations
  let costoReal = 0
  for (const alloc of allocations) {
    const precioCompra = comprasMap.get(alloc.compraDocumentoItemId) ?? 0
    costoReal += alloc.cantidad * precioCompra
  }

  return { costoReal, esLegacy: false }
}

/**
 * @description Devuelve las ventas de un producto con trazabilidad FIFO.
 *   Para cada venta, calcula el costo real desde PurchaseAllocation (o
 *   fallback a precioCosto para ventas legacy). Incluye resumen de
 *   rentabilidad calculado sobre todo el dataset filtrado.
 *
 *   Multi-tenant estricto: producto de otro tenant → NOT_FOUND opaco.
 *   Excluye ventas soft-deleted (deletedAt: null).
 */
export const getVentasProductoAction = withAction(
  async (
    input: GetVentasProductoInput,
    user: AuthenticatedUser,
  ): Promise<VentasProductoData> => {
    const parsed = validateInput(z.object({ productoId: z.string().min(1) }).extend(paginationShape).extend(dateFiltersShape), input)
    const tenantId = requireTenant(user)
    requireFeature(user, 'productos', 'ver trazabilidad de ventas')

    // 1. Verificar que el producto pertenece al tenant.
    const producto = await prisma.producto.findFirst({
      where: { id: parsed.productoId, tenantId },
      select: { id: true, precioCosto: true },
    })
    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND')
    }

    // 2. Calcular paginación.
    const page = parsed.page && parsed.page > 0 ? parsed.page : 1
    const limit =
      parsed.limit && parsed.limit > 0 && parsed.limit <= 100
        ? parsed.limit
        : VENTAS_DEFAULT_LIMIT
    const skip = (page - 1) * limit

    // 3. Construir el where con filtros.
    const baseWhere: Record<string, unknown> = {
      productoId: parsed.productoId,
      venta: { tenantId, deletedAt: null },
    }
    const ventaWhere: Record<string, unknown> = {}
    if (parsed.fechaDesde) {
      ventaWhere.createdAt = {
        ...((ventaWhere.createdAt as object) ?? {}),
        gte: new Date(parsed.fechaDesde),
      }
    }
    if (parsed.fechaHasta) {
      ventaWhere.createdAt = {
        ...((ventaWhere.createdAt as object) ?? {}),
        lte: new Date(parsed.fechaHasta),
      }
    }
    if (Object.keys(ventaWhere).length > 0) {
      baseWhere.venta = { ...(baseWhere.venta as object), ...ventaWhere }
    }

    const costoWhere: Prisma.Sql[] = [
      Prisma.sql`v."tenantId" = ${tenantId}`,
      Prisma.sql`v."deletedAt" IS NULL`,
      Prisma.sql`vi."productoId" = ${parsed.productoId}`,
    ]
    if (parsed.fechaDesde) {
      costoWhere.push(Prisma.sql`v."createdAt" >= ${new Date(parsed.fechaDesde)}`)
    }
    if (parsed.fechaHasta) {
      costoWhere.push(Prisma.sql`v."createdAt" <= ${new Date(parsed.fechaHasta)}`)
    }

    // 4. Queries en paralelo: items paginados y totales globales exactos.
    const [ventaItemsRaw, total, aggregate, costoRows] = await Promise.all([
      prisma.ventaItem.findMany({
        where: baseWhere,
        orderBy: { venta: { createdAt: 'desc' } },
        skip,
        take: limit,
        select: {
          id: true,
          ventaId: true,
          cantidad: true,
          precioUnitario: true,
          total: true,
          venta: {
            select: {
              createdAt: true,
              cliente: { select: { nombre: true } },
            },
          },
        },
      }),
      prisma.ventaItem.count({ where: baseWhere }),
      prisma.ventaItem.aggregate({
        where: baseWhere,
        _sum: { cantidad: true, total: true },
      }),
      prisma.$queryRaw<CostoGlobalRow[]>(Prisma.sql`
        SELECT COALESCE(SUM(costos."costoItem"), 0)::double precision AS "costoTotal"
        FROM (
          SELECT CASE
            WHEN COUNT(pa."id") = 0 THEN vi."cantidad"::bigint * ${producto.precioCosto}
            ELSE COALESCE(SUM(pa."cantidad"::bigint * cdi."precioUnitario"), 0)
          END AS "costoItem"
          FROM "venta_items" vi
          INNER JOIN "Venta" v ON v."ventaId" = vi."ventaId"
          LEFT JOIN "purchase_allocations" pa
            ON pa."ventaItemId" = vi."id" AND pa."tenantId" = ${tenantId}
          LEFT JOIN "CompraDocumentoItem" cdi
            ON cdi."compraDocumentoItemId" = pa."compraDocumentoItemId"
            AND cdi."tenantId" = ${tenantId}
          WHERE ${Prisma.join(costoWhere, ' AND ')}
          GROUP BY vi."id", vi."cantidad"
        ) costos
      `),
    ])

    // 5. Obtener allocations de los VentaItem de la página.
    const ventaItemIds = ventaItemsRaw.map((vi) => vi.id)
    const allocations =
      ventaItemIds.length > 0
        ? await prisma.purchaseAllocation.findMany({
            where: { ventaItemId: { in: ventaItemIds }, tenantId },
            select: { ventaItemId: true, compraDocumentoItemId: true, cantidad: true },
          })
        : []

    // 6. Obtener precios de las compras de las allocations.
    const compraIds = Array.from(
      new Set(allocations.map((a) => a.compraDocumentoItemId)),
    )
    const compras =
      compraIds.length > 0
        ? await prisma.compraDocumentoItem.findMany({
            where: { compraDocumentoItemId: { in: compraIds }, tenantId },
            select: { compraDocumentoItemId: true, precioUnitario: true },
          })
        : []

    const comprasMap = new Map(compras.map((c) => [c.compraDocumentoItemId, c.precioUnitario]))

    // 7. Agrupar allocations por ventaItemId.
    const allocationsPorVenta = new Map<string, Array<{ compraDocumentoItemId: string; cantidad: number }>>()
    for (const alloc of allocations) {
      const existing = allocationsPorVenta.get(alloc.ventaItemId) ?? []
      existing.push({ compraDocumentoItemId: alloc.compraDocumentoItemId, cantidad: alloc.cantidad })
      allocationsPorVenta.set(alloc.ventaItemId, existing)
    }

    // 8. Calcular costoReal y margenReal por venta.
    const items: VentaProductoItem[] = ventaItemsRaw.map((vi) => {
      const allocs = allocationsPorVenta.get(vi.id) ?? []
      const { costoReal, esLegacy } = calcularCostoFifoItem(
        vi.id,
        allocs,
        comprasMap,
        producto.precioCosto,
        vi.cantidad,
      )
      const ingresoTotal = vi.total
      const margenReal = ingresoTotal > 0 ? ((ingresoTotal - costoReal) / ingresoTotal) * 100 : 0

      return {
        ventaItemId: vi.id,
        ventaId: vi.ventaId,
        fecha: vi.venta.createdAt.toISOString(),
        clienteNombre: vi.venta.cliente?.nombre ?? 'Cliente genérico',
        cantidad: vi.cantidad,
        precioUnitario: vi.precioUnitario,
        ingresoTotal,
        costoReal,
        margenReal,
        esLegacy,
      }
    })

    // 9. Calcular resumen sobre todo el dataset filtrado.
    const totalVendido = aggregate._sum.total ?? 0
    const costoTotal = Number(costoRows[0]?.costoTotal ?? 0)
    const margenPromedio = totalVendido > 0 ? ((totalVendido - costoTotal) / totalVendido) * 100 : 0

    const resumen: VentasProductoResumen = {
      totalVendido,
      costoTotal,
      margenPromedio,
      cantidadVentas: total,
    }

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      resumen,
    }
  },
)
