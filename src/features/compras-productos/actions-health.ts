'use server'

import { prisma } from '@/lib/prisma'
import { ActionError, withAction } from '@/lib/server-actions'
import { requireTenant } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

export interface PurchaseHealthMetrics { comprasCount: number; comprasTotal: number; itemsCount: number; vendorActiveCount: number }

/** @description Obtiene los indicadores de compras del tenant activo. @param {void} _input - Sin parámetros. @param {AuthenticatedUser} user - Usuario autenticado. @returns {Promise<{ metrics: PurchaseHealthMetrics }>} Métricas de compra. */
export const getPurchaseHealthAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user)
  if (user.role !== 'admin') throw new ActionError('No tienes permisos para consultar la salud operativa.', 'FORBIDDEN')
  const [comprasCount, itemsCount, aggregate, vendorActiveCount] = await Promise.all([
    prisma.compraDocumento.count({ where: { tenantId } }),
    prisma.compraProducto.count({ where: { tenantId } }),
    prisma.compraProducto.aggregate({ where: { tenantId }, _sum: { total: true } }),
    prisma.vendor.count({ where: { tenantId } }),
  ])
  return { metrics: { comprasCount, comprasTotal: Number(aggregate._sum.total ?? 0), itemsCount, vendorActiveCount } }
})
