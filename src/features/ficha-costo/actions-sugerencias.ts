'use server'

import { revalidatePath } from 'next/cache'
import { withAction } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import { requireTenant, requireFeature } from '@/lib/services/tenant-scope'
import { recordCostChange, CostChangeReason } from '@/lib/cost-history-utils'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

// ─── Tipos ─────────────────────────────────────────────────

const MARGEN_DEFAULT = 0.30

export interface SugerenciaPrecioItem {
  productoId: string
  nombre: string
  codigoInterno: string | null
  precioCosto: number
  precioVentaActual: number
  precioSugerido: number
  diffAbsoluto: number
  diffPorcentaje: number
  margenObjetivo: number
  tienePlantilla: boolean
}

export interface AplicarSugerenciaInput {
  productoIds: string[]
}

export interface AplicarSugerenciaResult {
  updated: number
  skipped: number
  errors: Array<{ productoId: string; message: string }>
}

// ─── getSugerenciasPrecioAction ────────────────────────────

/**
 * @description Calcula sugerencias de precio para todos los productos del
 *   tenant. El precio sugerido = precioCosto × (1 + margenObjetivo). Si el
 *   producto tiene una plantilla activa, usa su margenObjetivo. Si no, usa
 *   el margen default del 30%.
 */
export const getSugerenciasPrecioAction = withAction(
  async (_input: {}, user: AuthenticatedUser): Promise<SugerenciaPrecioItem[]> => {
    const tenantId = requireTenant(user)

    const productos = await prisma.producto.findMany({
      where: { tenantId, precioCosto: { gt: 0 } },
      select: {
        id: true,
        nombre: true,
        precioCosto: true,
        precioVenta: true,
        codigoInterno: true,
      },
    })

    // Cargar plantillas activas en batch
    const templates = await prisma.productoCostSheetTemplate.findMany({
      where: {
        tenantId,
        esActiva: true,
        productoId: { in: productos.map((p) => p.id) },
      },
      select: { productoId: true, margenObjetivo: true },
    })
    const templateMap = new Map(templates.map((t) => [t.productoId, t.margenObjetivo]))

    return productos.map((p) => {
      const margen = templateMap.get(p.id) ?? MARGEN_DEFAULT
      const precioSugerido = Math.round(p.precioCosto * (1 + margen))
      const diff = precioSugerido - p.precioVenta

      return {
        productoId: p.id,
        nombre: p.nombre,
        codigoInterno: p.codigoInterno,
        precioCosto: p.precioCosto,
        precioVentaActual: p.precioVenta,
        precioSugerido,
        diffAbsoluto: diff,
        diffPorcentaje: p.precioVenta > 0
          ? Math.round((diff / p.precioVenta) * 10000) / 100
          : 100,
        margenObjetivo: margen,
        tienePlantilla: templateMap.has(p.id),
      }
    })
  },
)

// ─── aplicarSugerenciaPrecioAction ─────────────────────────

/**
 * @description Aplica el precio sugerido a los productos seleccionados.
 *   El precio sugerido = precioCosto × (1 + margenObjetivo). Registra
 *   cambios en ProductoCostHistory para auditoría.
 */
export const aplicarSugerenciaPrecioAction = withAction(
  async (
    input: AplicarSugerenciaInput,
    user: AuthenticatedUser,
  ): Promise<AplicarSugerenciaResult> => {
    const tenantId = requireTenant(user)
    requireFeature(user, 'ficha-costo-bulk', 'aplicar precios sugeridos')

    const productos = await prisma.producto.findMany({
      where: { id: { in: input.productoIds }, tenantId, precioCosto: { gt: 0 } },
      select: { id: true, precioCosto: true, precioVenta: true },
    })

    const templates = await prisma.productoCostSheetTemplate.findMany({
      where: { tenantId, esActiva: true, productoId: { in: productos.map((p) => p.id) } },
      select: { productoId: true, margenObjetivo: true },
    })
    const templateMap = new Map(templates.map((t) => [t.productoId, t.margenObjetivo]))

    let updated = 0
    const errors: AplicarSugerenciaResult['errors'] = []

    for (const p of productos) {
      try {
        const margen = templateMap.get(p.id) ?? MARGEN_DEFAULT
        const newPrecio = Math.round(p.precioCosto * (1 + margen))

        await prisma.$transaction(async (tx) => {
          await tx.producto.update({
            where: { id: p.id },
            data: { precioVenta: newPrecio },
          })
          await recordCostChange(tx, {
            productoId: p.id,
            oldPrecioCosto: p.precioCosto,
            newPrecioCosto: p.precioCosto,
            oldPrecioVenta: p.precioVenta,
            newPrecioVenta: newPrecio,
            reason: CostChangeReason.MANUAL_EDIT,
            changedBy: user.userId || 'system',
            notes: `Sugerencia de precio aplicada (margen ${(margen * 100).toFixed(0)}%)`,
          })
        })

        updated++
      } catch (err) {
        errors.push({
          productoId: p.id,
          message: err instanceof Error ? err.message : 'Error desconocido',
        })
      }
    }

    const skipped = input.productoIds.length - updated - errors.length

    revalidatePath('/busy/ficha-costo')
    return { updated, skipped, errors }
  },
)
