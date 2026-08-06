import { describe, expect, it, vi } from 'vitest';

import { getUserMetrics } from '@/lib/admin/userMetrics';

describe('getUserMetrics', () => {
  it('agrega métricas por roles de tenant cuando recibe tenantId', async () => {
    const monthStart = new Date('2026-01-01T00:00:00.000Z');
    const prisma = {
      $queryRawUnsafe: vi
        .fn()
        .mockResolvedValueOnce([
          {
            monthStart,
            usersCreated: 1,
            activeUsersStart: 2,
            activeUsersEnd: 3,
            inactiveUsers: 0,
            logins: 4,
            logouts: 5,
            blockedUsers: 6,
            admin: 7,
            manager: 8,
            economico: 9,
            dependiente: 10,
            regularUser: 11,
          },
        ])
        .mockResolvedValueOnce([{ totalUsers: 12n }])
        .mockResolvedValueOnce([{ action: 'login', count: 13n }]),
      user: {
        count: vi.fn().mockResolvedValue(10),
      },
    } as any;

    const result = await getUserMetrics(prisma, 6, 'tenant-1');

    expect(result.monthlyData[0].newUsersByRole).toEqual({
      admin: 7,
      manager: 8,
      economico: 9,
      dependiente: 10,
      regularUser: 11,
    });
    expect(result.summary.totalUsers).toBe(12);
    expect(result.summary.totalLogins).toBe(13);
  });
});
