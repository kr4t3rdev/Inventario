import { describe, expect, it, vi } from 'vitest';
import type { Prisma, PrismaClient } from '@/generated/prisma';
import { consumirResultadosShadow } from '../services/shadow-outbox';

function createDatabase() {
  const queryRaw = vi.fn(async (_query: TemplateStringsArray, ..._values: unknown[]) => []);
  const transaction = vi.fn(async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
    callback({ $queryRaw: queryRaw } as unknown as Prisma.TransactionClient),
  );
  return {
    db: { $transaction: transaction } as unknown as PrismaClient,
    queryRaw,
    transaction,
  };
}

describe('consumirResultadosShadow tenant scope', () => {
  it('refuses a missing tenant before opening a transaction', async () => {
    const { db, transaction } = createDatabase();

    await expect(
      consumirResultadosShadow(db, async () => {}, 100, undefined as unknown as string),
    ).rejects.toThrow('Tenant requerido');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('binds tenantId into the outbox selection', async () => {
    const { db, queryRaw } = createDatabase();

    await consumirResultadosShadow(db, async () => {}, 50, 'tenant-a');

    expect(queryRaw).toHaveBeenCalledOnce();
    const [query, tenantId] = queryRaw.mock.calls[0] as unknown as [TemplateStringsArray, string];
    expect(query.join('?')).toContain('"tenantId" = ?');
    expect(tenantId).toBe('tenant-a');
  });
});
