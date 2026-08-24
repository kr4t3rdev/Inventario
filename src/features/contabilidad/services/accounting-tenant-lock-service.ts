import type { Prisma } from '@/generated/prisma';

type AccountingLockClient = Pick<Prisma.TransactionClient, '$executeRaw'>;

const localTenantLocks = new Map<string, Promise<void>>();

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
 * La cola local complementa el lock de PostgreSQL para evitar solapamientos dentro
 * del mismo proceso; la autoridad entre procesos sigue siendo la base de datos.
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
  const previous = localTenantLocks.get(tenantId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  localTenantLocks.set(tenantId, queued);

  await previous;
  try {
    await acquireAccountingTenantLock(client, tenantId);
    return await operation();
  } finally {
    release();
    if (localTenantLocks.get(tenantId) === queued) {
      localTenantLocks.delete(tenantId);
    }
  }
}
