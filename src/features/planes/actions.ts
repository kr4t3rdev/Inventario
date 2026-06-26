'use server'

/**
 * @description Server Actions de planes (planes de suscripción/precios).
 * Acciones públicas y privadas para consultar planes desde la BD.
 *
 * @module features/planes/actions
 */

import { prisma } from '@/lib/prisma'
import {
  FEATURE_REGISTRY,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  getEnabledFeatureLabels,
} from './feature-registry'
import type { PlanDisplay } from './types'

/**
 * @description Retorna todos los planes ordenados por precio ascendente.
 * Incluye los features parseados.
 */
export async function getPlansAction() {
  const plans = await prisma.plan.findMany({
    orderBy: { precio: 'asc' },
  })

  return plans.map((plan) => ({
    ...plan,
    features: plan.features as Record<string, boolean>,
    precio: Number(plan.precio),
  }))
}

/**
 * @description Retorna los planes listos para mostrar en la landing pública.
 * Deriva los bullets y agrupaciones desde el Feature Registry.
 */
export async function getPlansPublicActionV2(): Promise<PlanDisplay[]> {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { precio: 'asc' },
    })

    return plans.map((plan) => {
      const features = (plan.features as Record<string, boolean>) ?? {}

      const enabledLabels = getEnabledFeatureLabels(features)

      // Agrupar features por categoría
      const featuresByCategory: Record<string, string[]> = {}
      for (const cat of CATEGORY_ORDER) {
        const catFeatures = FEATURE_REGISTRY.filter(
          (f) => f.category === cat && features[f.key] === true,
        ).map((f) => f.label)
        if (catFeatures.length > 0) {
          featuresByCategory[CATEGORY_LABELS[cat]] = catFeatures
        }
      }

      // Límites del plan como bullets
      const limitBullets: string[] = []
      if (plan.maxUsuarios > 0) {
        limitBullets.push(
          plan.maxUsuarios >= 999
            ? 'Usuarios ilimitados'
            : `Hasta ${plan.maxUsuarios} usuarios`,
        )
      }
      if (plan.maxAlmacenes > 0) {
        limitBullets.push(
          plan.maxAlmacenes >= 999
            ? 'Almacenes ilimitados'
            : `Hasta ${plan.maxAlmacenes} almacenes`,
        )
      }
      if (plan.maxPuntosVenta > 0) {
        limitBullets.push(
          plan.maxPuntosVenta >= 999
            ? 'Puntos de venta ilimitados'
            : `Hasta ${plan.maxPuntosVenta} puntos de venta`,
        )
      }
      if (plan.maxProductos > 0) {
        limitBullets.push(
          plan.maxProductos >= 999999
            ? 'Productos ilimitados'
            : `Hasta ${plan.maxProductos.toLocaleString()} productos`,
        )
      }

      const bullets = [...limitBullets, ...enabledLabels]

      const nameLower = plan.nombre.toLowerCase()
      const featured =
        nameLower === 'profesional' || nameLower === 'recomendado'
      const cta =
        nameLower === 'básico' || nameLower === 'basico'
          ? 'Comenzar'
          : nameLower === 'empresarial' || nameLower === 'enterprise'
            ? 'Hablar con ventas'
            : 'Solicitar demo'

      return {
        planId: plan.planId,
        name: plan.nombre,
        description: plan.descripcion,
        price: Number(plan.precio),
        bullets,
        featuresByCategory,
        featured,
        cta,
        limits: {
          maxUsuarios: plan.maxUsuarios,
          maxAlmacenes: plan.maxAlmacenes,
          maxProductos: plan.maxProductos,
          maxClientes: plan.maxClientes,
          maxPuntosVenta: plan.maxPuntosVenta,
        },
      }
    })
  } catch {
    return []
  }
}

export const getPlansPublicAction = getPlansPublicActionV2
