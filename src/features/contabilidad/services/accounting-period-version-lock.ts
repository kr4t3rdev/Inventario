import type { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';

type PeriodVersionClient = Pick<Prisma.TransactionClient, '$executeRaw' | '$queryRaw'>;

/**
 * @description Obtiene el bloqueo de versión del período para una escritura contable.
 * Si otra transacción cambió períodos después del snapshot, PostgreSQL aborta
 * snapshots RepeatableRead/Serializable al bloquear la fila modificada.
 * @param tx - Transacción que realizará la validación y el posteo.
 * @param tenantId - Tenant propietario de los períodos.
 * @returns La versión visible y bloqueada.
 */
export async function lockAccountingPeriodVersion(
  tx: PeriodVersionClient,
  tenantId: string,
): Promise<number> {
  await tx.$executeRaw`
    INSERT INTO "periodo_contable_versiones" ("tenantId", "version")
    VALUES (${tenantId}, 0)
    ON CONFLICT ("tenantId") DO NOTHING
  `;
  const rows = await tx.$queryRaw<Array<{ version: number }>>`
    SELECT "version"
    FROM "periodo_contable_versiones"
    WHERE "tenantId" = ${tenantId}
    FOR UPDATE
  `;
  if (rows.length !== 1 || !Number.isSafeInteger(rows[0].version)) {
    throw new ActionError('No se pudo bloquear la versión de períodos', 'PERIOD_VERSION_LOCK_FAILED');
  }
  return rows[0].version;
}

/**
 * @description Avanza la versión al crear, cerrar, aprobar o reabrir un período.
 * El caller debe haber adquirido antes el advisory lock del tenant.
 * @param tx - Transacción que muta el período.
 * @param tenantId - Tenant propietario de los períodos.
 * @returns void
 */
export async function advanceAccountingPeriodVersion(
  tx: PeriodVersionClient,
  tenantId: string,
): Promise<void> {
  const updated = await tx.$executeRaw`
    INSERT INTO "periodo_contable_versiones" ("tenantId", "version")
    VALUES (${tenantId}, 1)
    ON CONFLICT ("tenantId") DO UPDATE
    SET "version" = "periodo_contable_versiones"."version" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
  `;
  if (updated !== 1) {
    throw new ActionError('No se pudo avanzar la versión de períodos', 'PERIOD_VERSION_UPDATE_FAILED');
  }
}
