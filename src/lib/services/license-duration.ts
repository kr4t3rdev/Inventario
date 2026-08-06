/**
 * @description Resolución unificada de la duración de una licencia en días.
 *              Usado por los distintos flujos (creación de tenant, conversión
 *              de demo, renovación y licencias legacy) para que la duración
 *              provenga siempre del plan salvo override explícito.
 *
 * @module lib/services/license-duration
 */

import { ActionError } from '@/lib/server-actions'

/**
 * @description Resuelve la duración en días de una licencia: usa el override
 *              explícito cuando existe, o la duración del plan. Rechaza valores
 *              no enteros o <= 0. Retorna undefined solo si ambos son
 *              indefinidos (casos sin plan, como el branch worker legacy).
 * @param {number | undefined} planDurationDays - Duración declarada del plan.
 * @param {number | undefined} overrideDays - Override explícito del admin.
 * @returns {number | undefined} Días de vigencia resueltos.
 * @throws {ActionError} Si el valor resuelto no es un entero positivo.
 */
export function resolveLicenseDurationDays(
  planDurationDays: number | undefined,
  overrideDays?: number,
): number | undefined {
  const resolved = overrideDays ?? planDurationDays
  if (resolved === undefined) return undefined
  if (!Number.isInteger(resolved) || resolved <= 0) {
    throw new ActionError(
      'La duración de la licencia debe ser mayor que cero',
      'VALIDATION_ERROR',
    )
  }
  return resolved
}
