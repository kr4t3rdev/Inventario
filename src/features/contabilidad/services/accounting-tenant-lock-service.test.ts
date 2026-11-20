import { describe, expect, it, vi } from 'vitest';

import {
  acquireAccountingTenantLock,
  withAccountingTenantLock,
} from './accounting-tenant-lock-service';

describe('accounting tenant advisory lock', () => {
  it('uses the same PostgreSQL transaction lock key for every tenant writer', async () => {
    const client = { $executeRaw: vi.fn().mockResolvedValue(1) };

    await acquireAccountingTenantLock(client, 'tenant-a');

    expect(client.$executeRaw).toHaveBeenCalledTimes(1);
    expect(String(client.$executeRaw.mock.calls[0]?.[0])).toContain(
      'pg_advisory_xact_lock',
    );
  });

  it('allows reentrant acquisition in one transaction without a local lock queue', async () => {
    const client = { $executeRaw: vi.fn().mockResolvedValue(1) };
    const nestedOperation = vi.fn().mockResolvedValue('done');
    const result = await withAccountingTenantLock(client, 'tenant-a', () =>
      withAccountingTenantLock(client, 'tenant-a', nestedOperation),
    );

    expect(result).toBe('done');
    expect(client.$executeRaw).toHaveBeenCalledTimes(2);
    expect(nestedOperation).toHaveBeenCalledOnce();
  });
});
