/**
 * @description Wrapper componible para validación de período contable en Server Actions.
 *
 * Se usa DENTRO de `withAction`, antes de la lógica de negocio.
 * Extrae automáticamente la fecha del input y valida contra el PeriodoGuard.
 *
 * @module with-period-validation
 *
 * @example
 * ```typescript
 * import { withAction } from '@/lib/server-actions';
 * import { withPeriodValidation } from '@/lib/services/with-period-validation';
 *
 * export const miAction = withAction(
 *   withPeriodValidation(
 *     (input) => input.fechaReconciliacion ? new Date(input.fechaReconciliacion) : new Date(),
 *     async (input, user) => {
 *       // ... lógica de negocio
 *     }
 *   )
 * );
 * ```
 */

import { PeriodoGuard, getGuardConfigExtended } from './periodo-contable-guard';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

/**
 * Función que extrae la fecha de negocio del input de una Server Action.
 */
export type FechaExtractor<TInput> = (input: TInput) => Date | null;

/**
 * Decorador que agrega validación de período a una Server Action.
 * Se compone con `withAction` para validar período antes de ejecutar la lógica.
 *
 * Comportamiento según feature flag:
 * - `disabled`: bypassa la validación, ejecuta el handler directamente
 * - `audit-only`: valida, logea violaciones pero permite la operación
 * - `enforce`: valida, logea violaciones y lanza ActionError si no es writable
 *
 * @template TInput - Tipo del input de la Server Action.
 * @param {FechaExtractor<TInput>} extraerFecha - Función que extrae la fecha del input.
 *   Si retorna null, la validación se saltea.
 * @param {function(TInput, AuthenticatedUser): Promise<any>} handler - Handler original de negocio.
 * @returns {function(TInput, AuthenticatedUser): Promise<any>} Handler envuelto con validación.
 */
export function withPeriodValidation<TInput>(
  extraerFecha: FechaExtractor<TInput>,
  handler: (input: TInput, user: AuthenticatedUser) => Promise<any>,
): (input: TInput, user: AuthenticatedUser) => Promise<any> {
  return async (input: TInput, user: AuthenticatedUser) => {
    const config = getGuardConfigExtended();

    // Modo disabled: bypass completo, no hace falta instanciar el guard
    if (config.mode === 'disabled' || !config.enabled) {
      return handler(input, user);
    }

    const fecha = extraerFecha(input);

    // Si no hay fecha extraíble, no aplicamos validación de período
    if (!fecha || !user.tenantId) {
      return handler(input, user);
    }

    const guard = new PeriodoGuard(config);

    const result = await guard.verificarEscritura({
      fecha,
      tenantId: user.tenantId,
      tipoOperacion: 'devengo',
      actor: user.userId,
    });

    // Si no está permitido (modo enforce), lanzar error
    if (!result.permitido) {
      const { ActionError } = await import('@/lib/server-actions/types');
      throw new ActionError(
        result.error ?? 'Período no permite escrituras contables',
        result.codigo ?? 'PERIODO_ERROR',
      );
    }

    // Permitido (writable o audit-only)
    return handler(input, user);
  };
}
