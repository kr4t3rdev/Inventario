import type { Prisma } from '@/generated/prisma';

type AccountingLockClient = Pick<Prisma.TransactionClient, '$executeRaw'>;

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
