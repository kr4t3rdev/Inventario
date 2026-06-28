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
import {
  calcularPrecioSugerido,
  calcularCostoTotalPlantilla,
} from './lib/template-calc'
import type {
  PlantillaCosto,
  PlantillaCostoInput,
  UpdatePlantillaInput,
  ActivarPlantillaInput,
  AplicarPrecioSugeridoInput,
  PlantillaActivaResult,
  LineItem,
  CategoriaCosto,
  serializeNotas,
  parseNotas,
  lineItemsToLegacyFields,
  calcularTotalLineItems,
} from './types'

// ─── Helpers ──────────────────────────────────────────────

function toPlantillaCosto(row: any): PlantillaCosto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    productoId: row.productoId,
    version: row.version,
    nombre: row.nombre,
    costoMateriales: row.costoMateriales,
    costoManoObra: row.costoManoObra,
    costoIndirectos: row.costoIndirectos,
    margenObjetivo: row.margenObjetivo,
    precioSugerido: row.precioSugerido,
    esActiva: row.esActiva,
    notas: row.notas,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdById: row.createdById,
  }
}

// ─── Listar plantillas ────────────────────────────────────

export interface GetPlantillasInput {
  productoId: string
}

/**
 * @description Devuelve todas las plantillas de ficha de costo de un
 *   producto, ordenadas por versión descendente.
 */
export const getPlantillasAction = withAction(
  async (
    input: GetPlantillasInput,
    user: AuthenticatedUser,
  ): Promise<PlantillaCosto[]> => {
    const tenantId = requireTenant(user)
    requireFeature(user, 'productos', 'ver plantillas de costo')

    const producto = await prisma.producto.findFirst({
      where: { id: input.productoId, tenantId },
      select: { id: true },
    })
    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND')
    }

    const rows = await prisma.productoCostSheetTemplate.findMany({
      where: { productoId: input.productoId, tenantId },
      orderBy: { version: 'desc' },
    })

    return rows.map(toPlantillaCosto)
  },
)

// ─── Plantilla activa ─────────────────────────────────────

export interface GetPlantillaActivaInput {
  productoId: string
}

/**
 * @description Devuelve la plantilla activa de un producto junto con el
 *   costo total y el precio sugerido calculados. Si no hay plantilla
 *   activa, retorna plantilla=null.
 */
export const getPlantillaActivaAction = withAction(
  async (
    input: GetPlantillaActivaInput,
    user: AuthenticatedUser,
  ): Promise<PlantillaActivaResult> => {
    const tenantId = requireTenant(user)
    requireFeature(user, 'productos', 'ver plantillas de costo')

    const producto = await prisma.producto.findFirst({
      where: { id: input.productoId, tenantId },
      select: { id: true, precioCosto: true, precioVenta: true },
    })
    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND')
    }

    const row = await prisma.productoCostSheetTemplate.findFirst({
      where: { productoId: input.productoId, tenantId, esActiva: true },
    })

    if (!row) {
      return {
        plantilla: null,
        costoTotal: 0,
        precioSugerido: 0,
        deltaCostoVsActual: null,
        deltaPrecioVsVenta: null,
      }
    }

    const costoTotal = calcularCostoTotalPlantilla(
      row.costoMateriales,
      row.costoManoObra,
      row.costoIndirectos,
    )
    const precioSugerido = calcularPrecioSugerido(costoTotal, row.margenObjetivo)

    return {
      plantilla: toPlantillaCosto(row),
      costoTotal,
      precioSugerido,
      deltaCostoVsActual: costoTotal - producto.precioCosto,
      deltaPrecioVsVenta: precioSugerido - producto.precioVenta,
    }
  },
)

// ─── Crear plantilla ──────────────────────────────────────

/**
 * @description Crea una nueva plantilla de ficha de costo para el producto.
 *   Calcula automáticamente el precio sugerido. Asigna la siguiente
 *   versión secuencial. Requiere rol manager.
 */
export const createPlantillaAction = withAction(
  async (
    input: PlantillaCostoInput,
    user: AuthenticatedUser,
  ): Promise<PlantillaCosto> => {
    const tenantId = requireTenant(user)
    requireManagerRole(user, 'crear plantillas de costo')
    requireFeature(user, 'productos', 'crear plantillas de costo')

    const producto = await prisma.producto.findFirst({
      where: { id: input.productoId, tenantId },
      select: { id: true },
    })
    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND')
    }

    if (!input.nombre || input.nombre.trim().length === 0) {
      throw new ActionError('El nombre de la plantilla es obligatorio', 'VALIDATION_ERROR')
    }
    if (input.margenObjetivo <= 0 || input.margenObjetivo >= 1) {
      throw new ActionError('El margen objetivo debe estar entre 0 y 1', 'VALIDATION_ERROR')
    }
    if (input.costoMateriales < 0 || input.costoManoObra < 0 || input.costoIndirectos < 0) {
      throw new ActionError('Los costos no pueden ser negativos', 'VALIDATION_ERROR')
    }

    // Calcular precio sugerido antes de la transacción
    const costoTotal = calcularCostoTotalPlantilla(
      input.costoMateriales,
      input.costoManoObra,
      input.costoIndirectos,
    )
    const precioSugerido = calcularPrecioSugerido(costoTotal, input.margenObjetivo)

    // Transacción atómica: leer última versión + crear (evita race conditions)
    const row = await prisma.$transaction(async (tx) => {
      const ultima = await tx.productoCostSheetTemplate.findFirst({
        where: { productoId: input.productoId, tenantId },
        orderBy: { version: 'desc' },
        select: { version: true },
      })
      return tx.productoCostSheetTemplate.create({
        data: {
          tenantId,
          productoId: input.productoId,
          version: (ultima?.version ?? 0) + 1,
          nombre: input.nombre.trim(),
          costoMateriales: input.costoMateriales,
          costoManoObra: input.costoManoObra,
          costoIndirectos: input.costoIndirectos,
          margenObjetivo: input.margenObjetivo,
          precioSugerido,
          esActiva: false,
          notas: input.notas,
          createdById: user.userId || 'system',
        },
      })
    })

    return toPlantillaCosto(row)
  },
)

// ─── Actualizar plantilla ─────────────────────────────────

/**
 * @description Actualiza campos editables de una plantilla existente.
 *   No permite modificar campos calculados (precioSugerido, version).
 *   Requiere rol manager.
 */
export const updatePlantillaAction = withAction(
  async (
    input: UpdatePlantillaInput,
    user: AuthenticatedUser,
  ): Promise<PlantillaCosto> => {
    const tenantId = requireTenant(user)
    requireManagerRole(user, 'editar plantillas de costo')
    requireFeature(user, 'productos', 'editar plantillas de costo')

    const existente = await prisma.productoCostSheetTemplate.findFirst({
      where: { id: input.plantillaId, tenantId },
    })
    if (!existente) {
      throw new ActionError('Plantilla no encontrada', 'NOT_FOUND')
    }

    const data: Record<string, unknown> = {}
    if (input.nombre !== undefined) data.nombre = input.nombre.trim()
    if (input.costoMateriales !== undefined) {
      if (input.costoMateriales < 0) {
        throw new ActionError('El costo de materiales no puede ser negativo', 'VALIDATION_ERROR')
      }
      data.costoMateriales = input.costoMateriales
    }
    if (input.costoManoObra !== undefined) {
      if (input.costoManoObra < 0) {
        throw new ActionError('El costo de mano de obra no puede ser negativo', 'VALIDATION_ERROR')
      }
      data.costoManoObra = input.costoManoObra
    }
    if (input.costoIndirectos !== undefined) {
      if (input.costoIndirectos < 0) {
        throw new ActionError('El costo indirecto no puede ser negativo', 'VALIDATION_ERROR')
      }
      data.costoIndirectos = input.costoIndirectos
    }
    if (input.margenObjetivo !== undefined) {
      if (input.margenObjetivo <= 0 || input.margenObjetivo >= 1) {
        throw new ActionError('El margen objetivo debe estar entre 0 y 1', 'VALIDATION_ERROR')
      }
      data.margenObjetivo = input.margenObjetivo
    }
    if (input.notas !== undefined) data.notas = input.notas

    // Recalcular precio sugerido si cambiaron costos o margen
    const materiales = data.costoMateriales ?? existente.costoMateriales
    const mo = data.costoManoObra ?? existente.costoManoObra
    const indirectos = data.costoIndirectos ?? existente.costoIndirectos
    const margen = data.margenObjetivo ?? existente.margenObjetivo
    const costoTotal = calcularCostoTotalPlantilla(
      Number(materiales),
      Number(mo),
      Number(indirectos),
    )
    data.precioSugerido = calcularPrecioSugerido(costoTotal, Number(margen))

    const row = await prisma.productoCostSheetTemplate.update({
      where: { id: input.plantillaId },
      data,
    })

    return toPlantillaCosto(row)
  },
)

// ─── Activar plantilla ────────────────────────────────────

export interface DeletePlantillaInput {
  plantillaId: string
}

/**
 * @description Activa una plantilla y desactiva la anterior automáticamente
 *   dentro de una transacción atómica. Requiere rol manager.
 */
export const activarPlantillaAction = withAction(
  async (
    input: ActivarPlantillaInput,
    user: AuthenticatedUser,
  ): Promise<PlantillaCosto> => {
    const tenantId = requireTenant(user)
    requireManagerRole(user, 'activar plantillas de costo')
    requireFeature(user, 'productos', 'activar plantillas de costo')

    const plantilla = await prisma.productoCostSheetTemplate.findFirst({
      where: { id: input.plantillaId, tenantId, productoId: input.productoId },
    })
    if (!plantilla) {
      throw new ActionError('Plantilla no encontrada', 'NOT_FOUND')
    }

    // Transacción atómica: desactivar todas + activar la seleccionada
    await prisma.$transaction([
      prisma.productoCostSheetTemplate.updateMany({
        where: { productoId: input.productoId, tenantId, esActiva: true },
        data: { esActiva: false },
      }),
      prisma.productoCostSheetTemplate.update({
        where: { id: input.plantillaId },
        data: { esActiva: true },
      }),
    ])

    const row = await prisma.productoCostSheetTemplate.findFirstOrThrow({
      where: { id: input.plantillaId, tenantId },
    })

    revalidatePath(`/busy/ficha-costo/${input.productoId}`)
    return toPlantillaCosto(row)
  },
)

// ─── Eliminar plantilla ───────────────────────────────────

/**
 * @description Elimina una plantilla. No permite eliminar la plantilla
 *   activa (primero desactivarla). Requiere rol manager.
 */
export const deletePlantillaAction = withAction(
  async (
    input: DeletePlantillaInput,
    user: AuthenticatedUser,
  ): Promise<PlantillaCosto> => {
    const tenantId = requireTenant(user)
    requireManagerRole(user, 'eliminar plantillas de costo')
    requireFeature(user, 'productos', 'eliminar plantillas de costo')

    const plantilla = await prisma.productoCostSheetTemplate.findFirst({
      where: { id: input.plantillaId, tenantId },
    })
    if (!plantilla) {
      throw new ActionError('Plantilla no encontrada', 'NOT_FOUND')
    }
    if (plantilla.esActiva) {
      throw new ActionError(
        'No se puede eliminar la plantilla activa. Desactívela primero.',
        'VALIDATION_ERROR',
      )
    }

    await prisma.productoCostSheetTemplate.delete({
      where: { id: input.plantillaId },
    })

    return toPlantillaCosto(plantilla)
  },
)

// ─── Aplicar precio sugerido ──────────────────────────────

/**
 * @description Aplica el precio sugerido de la plantilla activa al
 *   Producto.precioVenta. Requiere rol manager. Registra el cambio
 *   en ProductoCostHistory para auditoría.
 */
export const aplicarPrecioSugeridoAction = withAction(
  async (
    input: AplicarPrecioSugeridoInput,
    user: AuthenticatedUser,
  ): Promise<{ id: string; precioVenta: number }> => {
    const tenantId = requireTenant(user)
    requireManagerRole(user, 'aplicar precio sugerido')
    requireFeature(user, 'productos', 'aplicar precio sugerido')

    const plantilla = await prisma.productoCostSheetTemplate.findFirst({
      where: {
        id: input.plantillaId,
        tenantId,
        productoId: input.productoId,
        esActiva: true,
      },
    })
    if (!plantilla) {
      throw new ActionError(
        'Plantilla no encontrada o no está activa',
        'NOT_FOUND',
      )
    }

    const producto = await prisma.producto.findFirst({
      where: { id: input.productoId, tenantId },
      select: { id: true, precioVenta: true, precioCosto: true },
    })
    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND')
    }

    const nuevoPrecio = Math.round(plantilla.precioSugerido)

    const actualizado = await prisma.producto.update({
      where: { id: input.productoId },
      data: { precioVenta: nuevoPrecio },
      select: { id: true, precioVenta: true },
    })

    // Auditoría
    try {
      await recordCostChange(prisma, {
        productoId: producto.id,
        oldPrecioCosto: producto.precioCosto,
        newPrecioCosto: producto.precioCosto,
        oldPrecioVenta: producto.precioVenta,
        newPrecioVenta: nuevoPrecio,
        reason: CostChangeReason.MANUAL_EDIT,
        changedBy: user.userId || 'system',
        notes: `Precio sugerido aplicado desde plantilla v${plantilla.version}`,
      })
    } catch (err) {
      console.error('Error registrando cost history (no bloqueante):', err)
    }

    revalidatePath(`/busy/ficha-costo/${input.productoId}`)
    revalidatePath('/busy/ficha-costo')

    return actualizado
  },
)
