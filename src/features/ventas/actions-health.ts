'use server'

import { prisma } from '@/lib/prisma'
import { ActionError, withAction } from '@/lib/server-actions'
import { requireTenant } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

export interface SalesHealthMetrics {
  ventasCount: number
  ventasTotal: number
  facturasCount: number
  ofertasCount: number
  serviciosCount: number
}

/**
 * @description Obtiene indicadores de ventas y facturación del tenant activo.
 * @param {void} _input - La acción no requiere parámetros de entrada.
 * @param {AuthenticatedUser} user - Usuario autenticado con contexto de tenant.
 * @returns {Promise<{ metrics: SalesHealthMetrics }>} Métricas de ventas del tenant.
 */
export const getSalesHealthAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user)

  if (user.role !== 'admin') {
    throw new ActionError('No tienes permisos para consultar la salud operativa.', 'FORBIDDEN')
  }

  const [ventasCount, ventasAggregate, facturasCount, ofertasCount, serviciosCount] =
    await Promise.all([
      prisma.venta.count({ where: { tenantId, deletedAt: null } }),
      prisma.venta.aggregate({ where: { tenantId, deletedAt: null }, _sum: { total: true } }),
      prisma.factura.count({ where: { tenantId, estado: { not: 'ANULADA' } } }),
      prisma.oferta.count({ where: { tenantId } }),
      prisma.servicios.count({ where: { tenantId } }),
    ])

  return {
    metrics: {
      ventasCount,
      ventasTotal: Number(ventasAggregate._sum.total ?? 0),
      facturasCount,
      ofertasCount,
      serviciosCount,
    },
  }
})
