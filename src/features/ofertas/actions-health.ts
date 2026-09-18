'use server'

import { prisma } from '@/lib/prisma'
import { ActionError, withAction } from '@/lib/server-actions'
import { requireTenant } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

export interface OffersServicesHealthMetrics { ofertasCount: number; serviciosCount: number }

/** @description Obtiene indicadores de ofertas y servicios del tenant activo. @param {void} _input - Sin parámetros. @param {AuthenticatedUser} user - Usuario autenticado. @returns {Promise<{ metrics: OffersServicesHealthMetrics }>} Métricas combinadas. */
export const getOffersServicesHealthAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user)
  if (user.role !== 'admin') throw new ActionError('No tienes permisos para consultar la salud operativa.', 'FORBIDDEN')
  const [ofertasCount, serviciosCount] = await Promise.all([
    prisma.oferta.count({ where: { tenantId } }),
    prisma.servicios.count({ where: { tenantId } }),
  ])
  return { metrics: { ofertasCount, serviciosCount } }
})