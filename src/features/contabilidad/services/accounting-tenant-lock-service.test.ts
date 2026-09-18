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

  it('serializes concurrent operations for the same tenant', async () => {
    let active = 0;
    let maxActive = 0;
    const client = { $executeRaw: vi.fn().mockResolvedValue(1) };
    const operation = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
    };

    const first = withAccountingTenantLock(client, 'tenant-a', operation);
    const second = withAccountingTenantLock(client, 'tenant-a', operation);
    await Promise.all([first, second]);

    expect(client.$executeRaw).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
  });
});
