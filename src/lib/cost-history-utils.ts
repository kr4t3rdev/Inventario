import { PrismaClient, CostChangeReason } from '@/generated/prisma'

/**
 * @description Enum para razones de cambio de costo — debe coincidir con Prisma schema
 */
export { CostChangeReason }

/**
 * @description Interfaz para parámetros de recordCostChange
 */
export interface RecordCostChangeParams {
  productoId: string
  oldPrecioCosto: number
  newPrecioCosto: number
  oldPrecioVenta: number
  newPrecioVenta: number
  reason: CostChangeReason
  changedBy: string // userId
  notes?: string | null
}

/**
 * @description Registra un cambio de costo en ProductoCostHistory de forma transaccional.
 * Evita duplicados y ensures atomicity. Si no hay cambio real, retorna null.
 *
 * @param {Prisma.PrismaClient} prisma - Instancia de Prisma client
 * @param {RecordCostChangeParams} params - Parámetros del cambio de costo
 * @returns {Promise<{ id: string; productoId: string } | null>} Record creado o null si no hay cambio
 */
export async function recordCostChange(
  prisma: PrismaClient | any,
  params: RecordCostChangeParams
): Promise<{ id: string; productoId: string } | null> {
  const {
    productoId,
    oldPrecioCosto,
    newPrecioCosto,
    oldPrecioVenta,
    newPrecioVenta,
    reason,
    changedBy,
    notes,
  } = params

  // Validar que al menos uno de los precios haya cambiado
  const costChanged = oldPrecioCosto !== newPrecioCosto
  const priceChanged = oldPrecioVenta !== newPrecioVenta

  if (!costChanged && !priceChanged) {
    // No hay cambio real, no grabar
    return null
  }

  // Validar que los valores sean numéricos y positivos
  if (
    typeof newPrecioCosto !== 'number' ||
    typeof newPrecioVenta !== 'number' ||
    newPrecioCosto < 0 ||
    newPrecioVenta < 0
  ) {
    throw new Error('Los precios deben ser números positivos')
  }

  // Validar que el producto exista
  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { id: true },
  })

  if (!producto) {
    throw new Error(`Producto con ID ${productoId} no encontrado`)
  }

  // Crear registro de historial de costo de forma atómica
  const historyRecord = await prisma.productoCostHistory.create({
    data: {
      productoId,
      oldPrecioCosto,
      newPrecioCosto,
      oldPrecioVenta,
      newPrecioVenta,
      reason,
      changedBy,
      changedAt: new Date(),
      notes: notes || null,
    },
    select: {
      id: true,
      productoId: true,
    },
  })

  return historyRecord
}

/**
 * @description Calcula el porcentaje de cambio de costo para display
 * @param {number} oldValue - Valor anterior
 * @param {number} newValue - Valor nuevo
 * @returns {number} Porcentaje de cambio (puede ser negativo)
 */
export function calculateCostChangePercent(oldValue: number, newValue: number): number {
  if (oldValue === 0) {
    return newValue > 0 ? 100 : 0
  }
  return ((newValue - oldValue) / oldValue) * 100
}

/**
 * @description Calcula el porcentaje de cambio de precio para display
 * @param {number} oldValue - Valor anterior
 * @param {number} newValue - Valor nuevo
 * @returns {number} Porcentaje de cambio (puede ser negativo)
 */
export function calculatePriceChangePercent(oldValue: number, newValue: number): number {
  if (oldValue === 0) {
    return newValue > 0 ? 100 : 0
  }
  return ((newValue - oldValue) / oldValue) * 100
}
