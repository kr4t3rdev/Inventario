/**
 * @description Capa de consulta unificada para StockUbicacion.
 *
 *   Proporciona funciones de LECTURA que siempre usan StockUbicacion
 *   como fuente de verdad única. No implementan fallbacks dinámicos
 *   ni cálculos alternativos — si no hay registro, retornan null/0.
 *
 *   Para operaciones de escritura, usar stock-ubicacion-service.ts
 *   (upsertStockUbicacion, incrementarStock, descontarStock, etc.).
 *
 * @module lib/services/stock-ubicacion-queries
 */

import type { TipoUbicacion } from './stock-ubicacion-service'

// ─── Tipos públicos ───────────────────────────────────────────

export interface StockPorUbicacion {
  productoId: string
  cantidad: number
  cantidadReservada: number
  cantidadDisponible: number
}

export interface ConsultaStockOpts {
  productoId: string
  tipoUbicacion: TipoUbicacion
  ubicacionId: string
}

export interface ConsultaStockBatchOpts {
  productoIds: string[]
  tipoUbicacion: TipoUbicacion
  ubicacionId: string
}

export interface ConsultaStockTotalOpts {
  productoId: string
}

export interface ConsultaStockTotalBatchOpts {
  productoIds: string[]
}

// ─── Select reutilizable ─────────────────────────────────────

const STOCK_SELECT = {
  productoId: true,
  cantidad: true,
  cantidadReservada: true,
  cantidadDisponible: true,
} as const

// ─── Consultas individuales ──────────────────────────────────

/**
 * @description Obtiene el stock de un producto en una ubicación específica.
 *   Sin fallbacks — solo lee de StockUbicacion como fuente de verdad única.
 *
 * @param tx - Cliente Prisma (directo o transaccional)
 * @param opts - { productoId, tipoUbicacion, ubicacionId }
 * @returns StockPorUbicacion o null si no hay registro
 */
export async function getStockPorUbicacion(
  tx: {
    stockUbicacion: {
      findUnique: (args: {
        where: {
          productoId_tipoUbicacion_ubicacionId: {
            productoId: string
            tipoUbicacion: string
            ubicacionId: string
          }
        }
        select: typeof STOCK_SELECT
      }) => Promise<{
        productoId: string
        cantidad: number
        cantidadReservada: number
        cantidadDisponible: number
      } | null>
    }
  },
  opts: ConsultaStockOpts,
): Promise<StockPorUbicacion | null> {
  const { productoId, tipoUbicacion, ubicacionId } = opts

  const registro = await tx.stockUbicacion.findUnique({
    where: {
      productoId_tipoUbicacion_ubicacionId: {
        productoId,
        tipoUbicacion,
        ubicacionId,
      },
    },
    select: STOCK_SELECT,
  })

  if (!registro) return null

  return {
    productoId,
    cantidad: registro.cantidad,
    cantidadReservada: registro.cantidadReservada,
    cantidadDisponible: registro.cantidadDisponible,
  }
}

// ─── Consultas batch ─────────────────────────────────────────

/**
 * @description Obtiene el stock de múltiples productos en una ubicación.
 *   Útil para cuadre POS, listados de productos, etc.
 *
 * @param tx - Cliente Prisma (directo o transaccional)
 * @param opts - { productoIds[], tipoUbicacion, ubicacionId }
 * @returns Map<productoId, StockPorUbicacion>
 */
export async function getStockPorUbicacionBatch(
  tx: {
    stockUbicacion: {
      findMany: (args: {
        where: {
          productoId: { in: string[] }
          tipoUbicacion: string
          ubicacionId: string
        }
        select: typeof STOCK_SELECT
      }) => Promise<Array<{
        productoId: string
        cantidad: number
        cantidadReservada: number
        cantidadDisponible: number
      }>>
    }
  },
  opts: ConsultaStockBatchOpts,
): Promise<Map<string, StockPorUbicacion>> {
  const { productoIds, tipoUbicacion, ubicacionId } = opts

  if (productoIds.length === 0) return new Map()

  const registros = await tx.stockUbicacion.findMany({
    where: {
      productoId: { in: productoIds },
      tipoUbicacion,
      ubicacionId,
    },
    select: STOCK_SELECT,
  })

  const map = new Map<string, StockPorUbicacion>()
  for (const r of registros) {
    map.set(r.productoId, {
      productoId: r.productoId,
      cantidad: r.cantidad,
      cantidadReservada: r.cantidadReservada,
      cantidadDisponible: r.cantidadDisponible,
    })
  }
  return map
}

// ─── Consulta de disponibilidad (validación) ─────────────────

/**
 * @description Valida si hay stock suficiente (cantidadDisponible) para
 *   una operación en una ubicación. Sin fallbacks.
 *
 * @param tx - Cliente Prisma
 * @param opts - { productoId, tipoUbicacion, ubicacionId, cantidadRequerida }
 * @returns true si hay stock suficiente, false si no
 */
export async function tieneStockSuficiente(
  tx: Parameters<typeof getStockPorUbicacion>[0],
  opts: ConsultaStockOpts & { cantidadRequerida: number },
): Promise<boolean> {
  const stock = await getStockPorUbicacion(tx, {
    productoId: opts.productoId,
    tipoUbicacion: opts.tipoUbicacion,
    ubicacionId: opts.ubicacionId,
  })

  if (!stock) return false

  return stock.cantidadDisponible >= opts.cantidadRequerida
}

// ─── Consulta de stock total derivado ───────────────────────

export async function getStockTotalProducto(
  tx: {
    stockUbicacion: {
      findMany: (args: {
        where: { productoId: string }
        select: { productoId: true; cantidad: true }
      }) => Promise<Array<{ productoId: string; cantidad: number }>>
    }
  },
  opts: ConsultaStockTotalOpts,
): Promise<number> {
  const registros = await tx.stockUbicacion.findMany({
    where: { productoId: opts.productoId },
    select: { productoId: true, cantidad: true },
  })

  return registros.reduce((sum, r) => sum + r.cantidad, 0)
}

export async function getStockTotalProductosBatch(
  tx: {
    stockUbicacion: {
      findMany: (args: {
        where: { productoId: { in: string[] } }
        select: { productoId: true; cantidad: true }
      }) => Promise<Array<{ productoId: string; cantidad: number }>>
    }
  },
  opts: ConsultaStockTotalBatchOpts,
): Promise<Map<string, number>> {
  if (opts.productoIds.length === 0) return new Map()

  const registros = await tx.stockUbicacion.findMany({
    where: { productoId: { in: opts.productoIds } },
    select: { productoId: true, cantidad: true },
  })

  const totals = new Map<string, number>()
  for (const productoId of opts.productoIds) {
    totals.set(productoId, 0)
  }

  for (const registro of registros) {
    totals.set(
      registro.productoId,
      (totals.get(registro.productoId) ?? 0) + registro.cantidad,
    )
  }

  return totals
}
