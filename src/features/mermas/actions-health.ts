'use server'

import { prisma } from '@/lib/prisma'
import { ActionError, withAction } from '@/lib/server-actions'
import { requireTenant } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

export interface WastageHealthMetrics { mermasCount: number; mermasTotalValue: number }

/** @description Obtiene los indicadores de mermas del tenant activo. @param {void} _input - Sin parámetros. @param {AuthenticatedUser} user - Usuario autenticado. @returns {Promise<{ metrics: WastageHealthMetrics }>} Métricas de mermas. */
export const getWastageHealthAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user)
  if (user.role !== 'admin') throw new ActionError('No tienes permisos para consultar la salud operativa.', 'FORBIDDEN')
  const [mermasCount, aggregate] = await Promise.all([
    prisma.merma.count({ where: { tenantId } }),
    prisma.merma.aggregate({ where: { tenantId }, _sum: { costoTotal: true } }),
  ])
  return { metrics: { mermasCount, mermasTotalValue: Number(aggregate._sum.costoTotal ?? 0) } }
})