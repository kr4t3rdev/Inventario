'use server'

import { withAction, ActionError } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import { requireTenant, requireFeature } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { calcularCostoSimpleInterno, normalizarMontoManual, round2 } from './lib/cost-calc-server'
import type {
  ComposicionCostoData,
  ComposicionMaterial,
  GetComposicionCostoInput,
} from './types'

/**
 * @description Recalcula la composición de un producto compuesto sumando
 *   el costo de materiales (CPP de cada ingrediente × cantidad) más los
 *   valores manuales de mano de obra e indirectos. Los valores manuales
 *   no se persisten; la UI los envía en cada cálculo.
 */
export const getComposicionCostoAction = withAction(
  async (
    input: GetComposicionCostoInput,
    user: AuthenticatedUser,
  ): Promise<ComposicionCostoData> => {
    const tenantId = requireTenant(user)
    requireFeature(user, 'productos', 'ver la composición de costo')

    const producto = await prisma.producto.findFirst({
      where: { id: input.productoId, tenantId },
      select: { id: true },
    })
    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND')
    }

    const manoObra = normalizarMontoManual(input.manoObra)
    const indirectos = normalizarMontoManual(input.indirectos)

    const receta = await prisma.receta.findFirst({
      where: { productoId: input.productoId, tenantId },
      include: {
        RecetaIngrediente: {
          include: { Producto: { select: { id: true, nombre: true } } },
        },
      },
    })

    const detalle: ComposicionMaterial[] = []
    let materiales = 0
    let ingredientesSinCosto = 0

    if (receta) {
      for (const ing of receta.RecetaIngrediente) {
        const { cpp, advertencias } = await calcularCostoSimpleInterno(
          ing.productoId,
          tenantId,
        )
        if (cpp === 0) ingredientesSinCosto += 1
        const factorDesp = 1 + (ing.desperdicio ?? 0) / 100
        const cantidadEfectiva = ing.cantidad * factorDesp
        const costoTotal = cpp * cantidadEfectiva
        materiales += costoTotal
        detalle.push({
          productoId: ing.productoId,
          nombre: ing.Producto.nombre,
          cantidad: ing.cantidad,
          desperdicio: ing.desperdicio,
          cpp,
          costoTotal,
          sinCosto: cpp === 0,
        })
        // Las advertencias del cálculo interno se ignoran en este endpoint
        // para no contaminar la respuesta; ya se reportan en la ficha.
        void advertencias
      }
    }

    const total = materiales + manoObra + indirectos
    const totalPos = total > 0 ? total : 1
    return {
      materiales,
      manoObra,
      indirectos,
      total,
      ingredientesSinCosto,
      detalle,
      porcentajes: {
        materiales: round2((materiales / totalPos) * 100),
        manoObra: round2((manoObra / totalPos) * 100),
        indirectos: round2((indirectos / totalPos) * 100),
      },
    }
  },
)
