'use server'

import { prisma } from '@/lib/prisma'
import { ActionError, withAction } from '@/lib/server-actions'
import { requireTenant } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

export interface AccountingHealthMetrics {
  hasActivePeriod: boolean
  currentPeriodStatus: string | null
  lastClosedPeriod: string | null
  totalPeriods: number
}

/** @description Devuelve los indicadores contables del tenant activo (periodos). @param {void} _input @param {AuthenticatedUser} user @returns {Promise<{ metrics: AccountingHealthMetrics }>} */
export const getAccountingHealthAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user)
  if (user.role !== 'admin') throw new ActionError('No tienes permisos para consultar la salud operativa.', 'FORBIDDEN')
  const [totalPeriods, active, lastClosed] = await Promise.all([
    prisma.periodoContable.count({ where: { tenantId } }),
    prisma.periodoContable.findFirst({ where: { tenantId, estado: 'ABIERTO' }, select: { codigo: true, estado: true } }),
    prisma.periodoContable.findFirst({ where: { tenantId, estado: 'CERRADO' }, orderBy: { fechaFin: 'desc' }, select: { codigo: true } }),
  ])
  return { metrics: { hasActivePeriod: !!active, currentPeriodStatus: active?.estado ?? null, lastClosedPeriod: lastClosed?.codigo ?? null, totalPeriods } }
})