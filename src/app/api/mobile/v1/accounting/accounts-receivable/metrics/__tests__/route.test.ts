import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ActionError } from '@/lib/server-actions';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/lib/services/tenant-scope', () => ({
  requireFeature: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-accounts-service', () => ({
  AccountingAccountsService: {
    getReceivablesMetrics: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { requireFeature, requirePermission } from '@/lib/services/tenant-scope';
import { AccountingAccountsService } from '@/features/contabilidad/services/accounting-accounts-service';
import { GET } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'manager',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { contabilidad: true, 'cuentas-cobrar': false },
};

/** @description Builds an authenticated mobile receivables metrics request. */
function metricsRequest(): NextRequest {
  return new NextRequest(
    'http://localhost/api/mobile/v1/accounting/accounts-receivable/metrics',
    { headers: { authorization: 'Bearer mobile-access' } },
  );
}

describe('mobile accounts receivable metrics route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireFeature).mockImplementation(() => undefined);
    vi.mocked(requirePermission).mockImplementation(() => undefined);
  });

  it('returns tenant receivables metrics after the contabilidad feature and permission checks', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingAccountsService.getReceivablesMetrics).mockResolvedValue({
      totalPendiente: 100,
      porVencer: 2,
      vencidas: 1,
      totalCuentas: 3,
    } as never);

    const response = await GET(metricsRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalPendiente).toBe(100);
    expect(requireFeature).toHaveBeenCalledWith(
      mockUser, 'contabilidad', 'consultar los saldos de cuentas por cobrar',
    );
    expect(requirePermission).toHaveBeenCalledWith(
      mockUser, 'financiero.contabilidad.acceder', 'consultar los saldos de cuentas por cobrar',
    );
    expect(AccountingAccountsService.getReceivablesMetrics).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
    });
  });

  it('maps a missing contabilidad feature to a forbidden response', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(requireFeature).mockImplementation(() => {
      throw new ActionError('Tu plan actual no incluye la funcionalidad', 'FEATURE_NOT_AVAILABLE');
    });

    const response = await GET(metricsRequest());
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('FEATURE_NOT_AVAILABLE');
    expect(AccountingAccountsService.getReceivablesMetrics).not.toHaveBeenCalled();
  });

  it('denies metrics without the financial accounting permission', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(requirePermission).mockImplementation(() => {
      throw new ActionError('No tienes permisos', 'FORBIDDEN');
    });

    const response = await GET(metricsRequest());
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('FORBIDDEN');
    expect(AccountingAccountsService.getReceivablesMetrics).not.toHaveBeenCalled();
  });
});
