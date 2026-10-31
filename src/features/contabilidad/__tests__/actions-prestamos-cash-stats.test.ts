import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionError } from '@/lib/server-actions';

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  groupBy: vi.fn(),
  findMany: vi.fn(),
  aggregate: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    prestamoCash: { count: mocks.count, groupBy: mocks.groupBy },
    cuentaPorCobrar: { findMany: mocks.findMany },
    reconciliacionVenta: { aggregate: mocks.aggregate },
  },
}));
vi.mock('@/lib/server-actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server-actions')>();
  return { ...actual, withAction: (action: unknown) => action };
});
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: () => 'tenant-1',
  requireFeature: vi.fn(),
  requirePermission: mocks.requirePermission,
}));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn(), logStrict: vi.fn() },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

describe('getPrestamosCashStatsAction tenant access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockImplementation(() => undefined);
    mocks.count.mockResolvedValue(0);
    mocks.groupBy.mockResolvedValue([]);
    mocks.findMany.mockResolvedValue([]);
    mocks.aggregate.mockResolvedValue({ _sum: { monto: null }, _avg: { monto: null } });
  });

  it('filters every accounting aggregate by the authenticated tenant', async () => {
    const { getPrestamosCashStatsAction } = await import('../actions-prestamos-cash');
    const user = { userId: 'user-1', tenantId: 'tenant-1' } as never;

    await getPrestamosCashStatsAction(undefined, user);

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      user, 'financiero.contabilidad.acceder', 'consultar estadísticas de préstamos cash',
    );
    expect(mocks.count).toHaveBeenCalledTimes(3);
    for (const [query] of mocks.count.mock.calls) {
      expect(query.where.tenantId).toBe('tenant-1');
    }
    expect(mocks.groupBy.mock.calls[0][0].where.tenantId).toBe('tenant-1');
    expect(mocks.findMany.mock.calls[0][0].where.tenantId).toBe('tenant-1');
    expect(mocks.aggregate.mock.calls[0][0].where.tenantId).toBe('tenant-1');
  });

  it('denies unauthorized stats before querying any accounting data', async () => {
    mocks.requirePermission.mockImplementation(() => {
      throw new ActionError('Forbidden', 'FORBIDDEN');
    });
    const { getPrestamosCashStatsAction } = await import('../actions-prestamos-cash');
    const user = { userId: 'user-1', tenantId: 'tenant-1' } as never;

    await expect(getPrestamosCashStatsAction(undefined, user)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.groupBy).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });
});
