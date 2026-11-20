import type { Prisma } from '@/generated/prisma';

type AccountingLockClient = Pick<Prisma.TransactionClient, '$executeRaw'>;
type AccountingTryLockClient = Pick<Prisma.TransactionClient, '$queryRaw'>;

/**
 * @description Adquiere el advisory lock transaccional común para un tenant contable.
 * @param {AccountingLockClient} client - Cliente de la transacción activa.
 * @param {string} tenantId - Identificador del tenant propietario de la mutación.
 * @returns {Promise<void>} Se resuelve cuando PostgreSQL retiene el lock.
 */
export async function acquireAccountingTenantLock(
  client: AccountingLockClient,
  tenantId: string,
): Promise<void> {
  await client.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${tenantId}, 0))
  `;
}

/**
 * @description Intenta adquirir un advisory lock transaccional para una apertura concreta.
 * No espera: si otra ejecucion solapada ya lo retiene, el llamador debe fallar.
 * Un reintento posterior, iniciado despues del commit, puede adquirirlo y verificar
 * la apertura consumida sin duplicar registros.
 * @param {AccountingTryLockClient} client - Cliente de la transaccion activa.
 * @param {string} tenantId - Identificador del tenant propietario de la solicitud.
 * @param {string} solicitudId - Identificador de la solicitud de apertura.
 * @returns {Promise<boolean>} True si el lock quedo adquirido en esta transaccion.
 */
export async function tryAcquireAccountingOpeningLock(
  client: AccountingTryLockClient,
  tenantId: string,
  solicitudId: string,
): Promise<boolean> {
  const lockIdentity = JSON.stringify(['apertura-manual', tenantId, solicitudId]);
  const result = await client.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_xact_lock(hashtextextended(${lockIdentity}, 0)) AS "locked"
  `;
  return result[0]?.locked === true;
}

/**
 * @description Ejecuta una operación bajo el lock contable del tenant.
 * PostgreSQL es el único coordinador. Una cola local puede invertir el orden
 * cuando una transacción adquiere el advisory lock antes de llamar este helper.
 * @param {AccountingLockClient} client - Cliente de la transacción activa.
 * @param {string} tenantId - Identificador del tenant propietario de la mutación.
 * @param {() => Promise<TResult>} operation - Mutación protegida.
 * @returns {Promise<TResult>} Resultado de la mutación.
 */
export async function withAccountingTenantLock<TResult>(
  client: AccountingLockClient,
  tenantId: string,
  operation: () => Promise<TResult>,
): Promise<TResult> {
  await acquireAccountingTenantLock(client, tenantId);
  return operation();
}
