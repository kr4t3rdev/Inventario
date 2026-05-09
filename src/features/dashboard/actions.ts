/**
 * @description Server Actions para Dashboard.
 * Llama a getDashboardStatsQuery() que contiene la lógica compartida pura.
 */
'use server'

import { withAction } from '@/lib/server-actions'
import { requireTenant } from '@/lib/services/tenant-scope'
import { getDashboardStatsQuery } from './queries'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

export const getDashboardStatsAction = withAction(async (
  params: { ubicacionId?: string; tipoUbicacion?: string } = {},
  user: AuthenticatedUser
) => {
  const tenantId = requireTenant(user)
  return getDashboardStatsQuery(tenantId)
})
