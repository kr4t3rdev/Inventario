'use server'

import { revalidatePath } from 'next/cache'
import { withAction, ActionError } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import {
  requirePermission,
} from '@/lib/services/tenant-scope'
import { recordCostChange, CostChangeReason } from '@/lib/cost-history-utils'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { requireFichaCostoFeature } from './lib/require-feature'
import { z } from 'zod'

// ─── Schemas de validación ─────────────────────────────────

const bulkPercentageSchema = z.object({
  porcentaje: z.number().gt(-100).lt(1000),
  productoIds: z.array(z.string()),
})

const bulkTemplateSchema = z.object({
  plantillaId: z.string().min(1),
  productoIds: z.array(z.string()),
})

// ─── Tipos ─────────────────────────────────────────────────

export interface BulkApplyPercentageInput {
  porcentaje: number
  productoIds: string[]
}

export interface BulkApplyTemplateInput {
  plantillaId: string
  productoIds: string[]
}

export interface BulkPriceResult {
  productoId: string
  oldPrecio: number
  newPrecio: number
}

export interface BulkPriceError {
  productoId: string
  message: string
}

export interface BulkPriceResponse {
  updated: number
  skipped: BulkPriceError[]
  errors: BulkPriceError[]
  results: BulkPriceResult[]
}

// ─── Constantes ────────────────────────────────────────────

const BULK_CHUNK_SIZE = 50
const BULK_TRANSACTION_CONCURRENCY = 5

// ─── bulkApplyPercentageAction ─────────────────────────────

/**
 * @description Aplica un porcentaje de ajuste al precioVenta de múltiples productos.
 * Procesa en chunks de 50 productos para evitar timeouts. Reporta errores parciales
 * sin abortar toda la operación.
 *
 * @param {BulkApplyPercentageInput} input - Porcentaje y lista de productoIds
 * @param {AuthenticatedUser} user - Usuario autenticado
 * @returns {Promise<BulkPriceResponse>} Resultado con updated, skipped, errors, results
 */
export const bulkApplyPercentageAction = withAction(
  async (
    input: BulkApplyPercentageInput,
    user: AuthenticatedUser,
  ): Promise<BulkPriceResponse> => {
    const tenantId = requireFichaCostoFeature(user, 'ficha-costo')
    requireFichaCostoFeature(user, 'ficha-costo-bulk')
    requirePermission(user, 'inventario.ficha-costo.bulk', 'ajustar precios masivamente')

    // Validación
    const parsed = bulkPercentageSchema.safeParse(input)
    if (!parsed.success) {
      throw new ActionError(
        `porcentaje inválido: ${parsed.error.issues[0].message}`,
        'VALIDATION_ERROR',
      )
    }

    const { porcentaje, productoIds } = parsed.data

    // Early return si no hay productos
    if (productoIds.length === 0) {
      return { updated: 0, skipped: [], errors: [], results: [] }
    }

    // Buscar productos existentes (filtrados por tenantId)
    const productos = await prisma.producto.findMany({
      where: {
        id: { in: productoIds },
        tenantId,
      },
      select: { id: true, precioVenta: true, precioCosto: true },
    })

    const productoMap = new Map(productos.map((p) => [p.id, p]))
    const skipped: BulkPriceError[] = []
    const errors: BulkPriceError[] = []
    const results: BulkPriceResult[] = []

    // Identificar productos no encontrados → skipped
    for (const id of productoIds) {
      if (!productoMap.has(id)) {
        skipped.push({ productoId: id, message: 'Producto no encontrado o sin permisos' })
      }
    }

    // Procesar en chunks
    const chunks = []
    for (let i = 0; i < productos.length; i += BULK_CHUNK_SIZE) {
      chunks.push(productos.slice(i, i + BULK_CHUNK_SIZE))
    }

    for (const chunk of chunks) {
      for (let offset = 0; offset < chunk.length; offset += BULK_TRANSACTION_CONCURRENCY) {
        const batch = chunk.slice(offset, offset + BULK_TRANSACTION_CONCURRENCY)
        const outcomes = await Promise.all(
          batch.map(async (producto) => {
            const newPrecio = Math.round(
              producto.precioVenta * (1 + porcentaje / 100),
            )

            try {
              await prisma.$transaction(async (tx) => {
                const updated = await tx.producto.updateMany({
                where: {
                  id: producto.id,
                  tenantId,
                  precioVenta: producto.precioVenta,
                },
                data: { precioVenta: newPrecio },
              })
              if (updated.count !== 1) {
                throw new Error('El precio cambió durante el ajuste; vuelve a intentarlo')
              }

              await recordCostChange(tx, {
                productoId: producto.id,
                oldPrecioCosto: producto.precioCosto,
                newPrecioCosto: producto.precioCosto,
                oldPrecioVenta: producto.precioVenta,
                newPrecioVenta: newPrecio,
                reason: CostChangeReason.ADJUSTMENT,
                changedBy: user.userId || 'system',
                notes: `Ajuste masivo de ${porcentaje}%`,
              })
            })

            return {
              result: {
                productoId: producto.id,
                oldPrecio: producto.precioVenta,
                newPrecio,
              },
            }
          } catch (err) {
            return {
              error: {
                productoId: producto.id,
                message: err instanceof Error ? err.message : 'Error desconocido',
              },
            }
          }
          }),
        )

        for (const outcome of outcomes) {
          if (outcome.result) results.push(outcome.result)
          if (outcome.error) errors.push(outcome.error)
        }
      }
    }

    revalidatePath('/busy/ficha-costo')
    return {
      updated: results.length,
      skipped,
      errors,
      results,
    }
  },
)

// ─── bulkApplyTemplateAction ───────────────────────────────

/**
 * @description Aplica el precioSugerido de una plantilla a múltiples productos.
 * Busca la plantilla una sola vez (cache) y la aplica a todos los productos.
 * Procesa en chunks de 50 productos para evitar timeouts.
 *
 * @param {BulkApplyTemplateInput} input - plantillaId y lista de productoIds
 * @param {AuthenticatedUser} user - Usuario autenticado
 * @returns {Promise<BulkPriceResponse>} Resultado con updated, skipped, errors, results
 */
export const bulkApplyTemplateAction = withAction(
  async (
    input: BulkApplyTemplateInput,
    user: AuthenticatedUser,
  ): Promise<BulkPriceResponse> => {
    const tenantId = requireFichaCostoFeature(user, 'ficha-costo')
    requireFichaCostoFeature(user, 'ficha-costo-bulk')
    requirePermission(user, 'inventario.ficha-costo.bulk', 'aplicar plantilla masivamente')

    // Validación
    const parsed = bulkTemplateSchema.safeParse(input)
    if (!parsed.success) {
      throw new ActionError(
        `plantillaId inválido: ${parsed.error.issues[0].message}`,
        'VALIDATION_ERROR',
      )
    }

    const { plantillaId, productoIds } = parsed.data

    // Early return si no hay productos
    if (productoIds.length === 0) {
      return { updated: 0, skipped: [], errors: [], results: [] }
    }

    // Buscar plantilla (una sola vez, filtrada por tenantId)
    const plantilla = await prisma.productoCostSheetTemplate.findFirst({
      where: {
        id: plantillaId,
        tenantId,
      },
      select: { id: true, precioSugerido: true, tenantId: true },
    })

    if (!plantilla) {
      throw new ActionError(
        'Plantilla no encontrada o sin permisos',
        'NOT_FOUND',
      )
    }

    // Buscar productos existentes (filtrados por tenantId)
    const productos = await prisma.producto.findMany({
      where: {
        id: { in: productoIds },
        tenantId,
      },
      select: { id: true, precioVenta: true, precioCosto: true },
    })

    const productoMap = new Map(productos.map((p) => [p.id, p]))
    const skipped: BulkPriceError[] = []
    const errors: BulkPriceError[] = []
    const results: BulkPriceResult[] = []

    // Identificar productos no encontrados → skipped
    for (const id of productoIds) {
      if (!productoMap.has(id)) {
        skipped.push({ productoId: id, message: 'Producto no encontrado o sin permisos' })
      }
    }

    // Procesar en chunks
    const chunks = []
    for (let i = 0; i < productos.length; i += BULK_CHUNK_SIZE) {
      chunks.push(productos.slice(i, i + BULK_CHUNK_SIZE))
    }

    for (const chunk of chunks) {
      for (let offset = 0; offset < chunk.length; offset += BULK_TRANSACTION_CONCURRENCY) {
        const batch = chunk.slice(offset, offset + BULK_TRANSACTION_CONCURRENCY)
        const outcomes = await Promise.all(
          batch.map(async (producto) => {
            const newPrecio = Math.round(plantilla.precioSugerido)

            try {
              await prisma.$transaction(async (tx) => {
                const updated = await tx.producto.updateMany({
                where: {
                  id: producto.id,
                  tenantId,
                  precioVenta: producto.precioVenta,
                },
                data: { precioVenta: newPrecio },
              })
              if (updated.count !== 1) {
                throw new Error('El precio cambió durante el ajuste; vuelve a intentarlo')
              }

              await recordCostChange(tx, {
                productoId: producto.id,
                oldPrecioCosto: producto.precioCosto,
                newPrecioCosto: producto.precioCosto,
                oldPrecioVenta: producto.precioVenta,
                newPrecioVenta: newPrecio,
                reason: CostChangeReason.MANUAL_EDIT,
                changedBy: user.userId || 'system',
                notes: 'Plantilla aplicada masivamente',
              })
            })

            return {
              result: {
                productoId: producto.id,
                oldPrecio: producto.precioVenta,
                newPrecio,
              },
            }
          } catch (err) {
            return {
              error: {
                productoId: producto.id,
                message: err instanceof Error ? err.message : 'Error desconocido',
              },
            }
          }
          }),
        )

        for (const outcome of outcomes) {
          if (outcome.result) results.push(outcome.result)
          if (outcome.error) errors.push(outcome.error)
        }
      }
    }

    revalidatePath('/busy/ficha-costo')
    return {
      updated: results.length,
      skipped,
      errors,
      results,
    }
  },
)
