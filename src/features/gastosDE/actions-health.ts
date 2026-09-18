'use server'

import { prisma } from '@/lib/prisma'
import { ActionError, withAction } from '@/lib/server-actions'
import { requireTenant } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

export interface ExpenseHealthMetrics { gastosCount: number; gastosTotal: number }

/** @description Obtiene los indicadores de gastos del tenant activo. @param {void} _input - Sin parámetros. @param {AuthenticatedUser} user - Usuario autenticado. @returns {Promise<{ metrics: ExpenseHealthMetrics }>} Métricas de gastos. */
export const getExpenseHealthAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user)
  if (user.role !== 'admin') throw new ActionError('No tienes permisos para consultar la salud operativa.', 'FORBIDDEN')
  const [gastosCount, aggregate] = await Promise.all([
    prisma.gastosDE.count({ where: { tenantId } }),
    prisma.gastosDE.aggregate({ where: { tenantId }, _sum: { monto: true } }),
  ])
  return { metrics: { gastosCount, gastosTotal: Number(aggregate._sum.monto ?? 0) } }
})