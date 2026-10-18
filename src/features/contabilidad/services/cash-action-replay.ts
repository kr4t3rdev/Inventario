import { ActionError } from '@/lib/server-actions';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

interface CashActionReplayParams<T> {
  user: AuthenticatedUser;
  /** Revalidate tenant/feature/permission and look up under the writer lock. */
  findReplay: () => Promise<T | null>;
  /** The writer retains its lookup under lock and uses the validated operation date. */
  write: (operationDate: Date) => Promise<T>;
}

const PROTECTED_PERIOD_CODES = new Set([
  'PERIODO_CERRADO', 'PERIODO_APROBADO', 'PERIODO_EN_CIERRE',
]);

/**
 * @description Replays confirmed cash operations without treating them as new writes.
 * @param {CashActionReplayParams<T>} params - Authorized lookup and action writer.
 * @returns {Promise<T>} A confirmed replay or a new write in an open period.
 */
export async function runCashActionWithReplay<T>({
  user,
  findReplay,
  write,
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
    if (error instanceof ActionError && PROTECTED_PERIOD_CODES.has(error.code ?? '')) {
      const confirmed = await findReplay();
      if (confirmed) return confirmed;
    }
    throw error;
  }

  return write(operationDate);
}
