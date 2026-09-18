import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/reconciliation-stats-service', () => ({
  getReconciliationStats: vi.fn(),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { requireTenant } from '@/lib/services/tenant-scope';
import {
  getReconciliationStats,
  type ReconciliationStatsSnapshot,
} from '@/features/contabilidad/services/reconciliation-stats-service';
import { GET } from '../route';

const user = { userId: 'u1', tenantId: 'tenant-web-1' };
const snapshot: ReconciliationStatsSnapshot = {
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
      type: 'venta',
      reference: 'Venta #sale-1...',
      description: 'Venta reconciliada',
      accountName: 'Banco 1',
      amount: 100,
      date: '2026-09-04T12:00:00.000Z',
    },
  ],
};

describe('web accounting reconciliation stats route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireTenant).mockReturnValue('tenant-web-1');
    vi.mocked(getReconciliationStats).mockResolvedValue(snapshot);
  });

  it('passes authentication through and exposes the raw canonical snapshot', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/reconciliacion/stats'),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(snapshot);
    expect(authenticateUser).toHaveBeenCalledWith(expect.any(NextRequest));
    expect(requireTenant).toHaveBeenCalledWith(user);
    expect(getReconciliationStats).toHaveBeenCalledWith({ tenantId: 'tenant-web-1' });
  });

  it('returns authentication failures unchanged and does not call the service', async () => {
    const authResponse = Response.json({ error: 'Token no proporcionado' }, { status: 401 });
    vi.mocked(authenticateUser).mockResolvedValue(authResponse as never);

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/reconciliacion/stats'),
    );

    expect(response).toBe(authResponse);
    expect(getReconciliationStats).not.toHaveBeenCalled();
  });

  it('returns the exact internal-error contract when the service fails', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);
    vi.mocked(getReconciliationStats).mockRejectedValueOnce(new Error('service unavailable'));

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/reconciliacion/stats'),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR',
    });
  });
});
