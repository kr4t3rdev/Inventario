import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { ActionError } from '@/lib/server-actions/types'
import { requireTenant } from '@/lib/services/tenant-scope'

export type FichaCostoFeature = 'ficha-costo' | 'ficha-costo-bulk'

/**
 * @description Exige un tenant activo y una feature exacta de Ficha de Costo sin bypass administrativo.
 * @param {AuthenticatedUser} user - Usuario autenticado con el snapshot efectivo del plan.
 * @param {FichaCostoFeature} featureKey - Feature exacta requerida para la operación.
 * @returns {string} Identificador del tenant activo.
 * @throws {ActionError} Cuando el plan efectivo no incluye la feature requerida.
 */
export function requireFichaCostoFeature(
  user: AuthenticatedUser,
  featureKey: FichaCostoFeature,
): string {
  const tenantId = requireTenant(user)

  if (user.planFeatures?.[featureKey] !== true) {
    throw new ActionError(
      'Tu plan actual no incluye la funcionalidad de Ficha de Costo. Actualiza tu plan para continuar.',
      'FEATURE_NOT_AVAILABLE',
    )
  }

  return tenantId
}
