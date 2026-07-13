'use server'

import { prisma } from '@/lib/prisma'
import { ActionError, withAction } from '@/lib/server-actions'
import { requireTenant } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

export interface BillingHealthMetrics {
  facturasCount: number
  ventasCount: number
  formalizationRate: number
}

/**
 * @description Obtiene la tasa de formalización del tenant activo.
 * @param {void} _input - La acción no requiere parámetros de entrada.
 * @param {AuthenticatedUser} user - Usuario autenticado con contexto de tenant.
 * @returns {Promise<{ metrics: BillingHealthMetrics }>} Métricas de facturación del tenant.
 */
export const getBillingHealthAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user)

  if (user.role !== 'admin') {
    throw new ActionError('No tienes permisos para consultar la salud operativa.', 'FORBIDDEN')
  }

  const [facturasCount, ventasCount] = await Promise.all([
    prisma.factura.count({ where: { tenantId } }),
    prisma.venta.count({ where: { tenantId } }),
  ])

  return {
    metrics: {
      facturasCount,
      ventasCount,
      formalizationRate: ventasCount > 0 ? Math.round((facturasCount / ventasCount) * 100) : 0,
    },
  }
})
