import type { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';
import { getGuardConfigExtended } from '@/lib/services/periodo-contable-guard';
import { PeriodoContableService } from '@/lib/services/periodo-contable-service';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';

type PeriodWriteTransaction = Pick<Prisma.TransactionClient, '$executeRaw' | 'periodoContable'>;

/**
 * @description Serializes a financial write with period closure and validates against the live
 * period row in the same transaction, bypassing the shared cache.
 * @param {Object} input - Tenant, business date, actor, and transaction client.
 * @returns {Promise<void>} Resolves only when this write may proceed.
 * @throws {ActionError} When enforce mode sees a missing or non-writable period.
 */
export async function guardAccountingWriteInTransaction(input: {
  client: PeriodWriteTransaction;
  tenantId: string;
  businessDate: Date;
  actorId: string;
}): Promise<void> {
  await acquireAccountingTenantLock(input.client, input.tenantId);
  const config = getGuardConfigExtended();
  if (config.mode === 'disabled') return;

  const result = await PeriodoContableService.validarEscritura(
    input.businessDate,
    input.tenantId,
    'devengo',
    input.client,
  );
  if (result.permitido) return;

  const message = result.error?.message ?? 'El período contable no permite escrituras.';
  if (config.mode === 'enforce') {
    throw new ActionError(message, result.error?.code ?? 'PERIODO_ERROR');
  }
  console.warn(
    `[PeriodoGuard] AUDIT-ONLY — ${message}; tenantId=${input.tenantId}; actorId=${input.actorId}`,
  );
}
