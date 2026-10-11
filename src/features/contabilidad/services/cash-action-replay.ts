import { ActionError } from '@/lib/server-actions';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

interface CashActionReplayParams<T> {
  user: AuthenticatedUser;
  /** Revalida tenant/feature/permiso y consulta bajo el lock del writer. */
  findReplay: () => Promise<T | null>;
  /** El writer conserva su lookup bajo lock y usa la fecha validada. */
  write: (operationDate: Date) => Promise<T>;
}

const PROTECTED_PERIOD_CODES = new Set([
  'PERIODO_CERRADO', 'PERIODO_APROBADO', 'PERIODO_EN_CIERRE',
]);

/**
 * @description Reproduce operaciones cash confirmadas sin tratarlas como escrituras nuevas.
 * @param {CashActionReplayParams<T>} params - Lookup autorizado y writer de la action.
 * @returns {Promise<T>} Operación confirmada o nueva escritura en período permitido.
 */
export async function runCashActionWithReplay<T>({
  user, findReplay, write,
}: CashActionReplayParams<T>): Promise<T> {
  const existing = await findReplay();
  if (existing) return existing;

  const operationDate = new Date();
  try {
    await withPeriodValidation<void>(
      () => operationDate,
      async () => undefined,
    )(undefined, user);
  } catch (error) {
    // Otro request puede confirmar entre el primer lookup y el rechazo del guard.
    // Solo se relee ante período protegido; no ocultar fallos de infraestructura/auditoría.
    if (error instanceof ActionError && PROTECTED_PERIOD_CODES.has(error.code ?? '')) {
      const confirmed = await findReplay();
      if (confirmed) return confirmed;
    }
    throw error;
  }

  return write(operationDate);
}
