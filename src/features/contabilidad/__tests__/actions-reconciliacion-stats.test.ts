import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const requireFeatureMock = vi.hoisted(() => vi.fn());
const requireTenantMock = vi.hoisted(() => vi.fn());
const getReconciliationStatsMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock('@/lib/services/tenant-scope', () => ({
  requireFeature: requireFeatureMock,
  requireTenant: requireTenantMock,
}));

vi.mock('@/features/contabilidad/services/reconciliation-stats-service', () => ({
  getReconciliationStats: getReconciliationStatsMock,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getReconciliacionStatsAction } from '@/features/contabilidad/actions-reconciliacion';
import { ActionError } from '@/lib/server-actions';

const user = {
  userId: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin' as const,
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager' as const,
};

const snapshot = {
  modules: {
    ventas: { pending: 2, completedToday: 1, totalToday: 3 },
    servicios: { pending: 1, completedToday: 2, totalToday: 3 },
    gastos: { pending: 4, completedToday: 3, totalToday: 7 },
  },
  stats: {
    totalPending: 7,
    completedToday: 6,
    reconciledAmount: 1234.5,
    efficiency: 46,
  },
  recentActivity: [
    {
      id: 'reconciliation-1',
      type: 'venta' as const,
      reference: 'Venta #sale-1...',
      description: 'Venta reconciliada',
      accountName: 'Banco 1',
      amount: 100,
      date: '2026-09-04T12:00:00.000Z',
    },
  ],
};

describe('getReconciliacionStatsAction adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockResolvedValue(user);
    requireTenantMock.mockReturnValue('tenant-1');
    getReconciliationStatsMock.mockResolvedValue(snapshot);
  });

  it('preserves feature and tenant guards and returns the service snapshot in data', async () => {
    const result = await getReconciliacionStatsAction();

    expect(requireFeatureMock).toHaveBeenCalledWith(
      user,
      'contabilidad',
      'consultar el estado de reconciliación',
    );
    expect(requireTenantMock).toHaveBeenCalledWith(user);
    expect(getReconciliationStatsMock).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    expect(result).toEqual({ success: true, data: snapshot });
  });

  it('preserves authentication, authorization, and service failure envelopes', async () => {
    getCurrentUserMock.mockResolvedValueOnce(null);

    await expect(getReconciliacionStatsAction()).resolves.toEqual({
      success: false,
      error: { message: 'Unauthorized', code: 'AUTH_REQUIRED' },
    });
    expect(getReconciliationStatsMock).not.toHaveBeenCalled();

    getCurrentUserMock.mockResolvedValueOnce(user);
    requireFeatureMock.mockImplementationOnce(() => {
      throw new ActionError('No autorizado', 'FORBIDDEN');
    });

    await expect(getReconciliacionStatsAction()).resolves.toEqual({
      success: false,
      error: { message: 'No autorizado', code: 'FORBIDDEN' },
    });
    expect(requireTenantMock).not.toHaveBeenCalled();
    expect(getReconciliationStatsMock).not.toHaveBeenCalled();

    getCurrentUserMock.mockResolvedValueOnce(user);
    getReconciliationStatsMock.mockRejectedValueOnce(new Error('service unavailable'));

    await expect(getReconciliacionStatsAction()).resolves.toEqual({
      success: false,
      error: { message: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
    });
    expect(getReconciliationStatsMock).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
  });
});
