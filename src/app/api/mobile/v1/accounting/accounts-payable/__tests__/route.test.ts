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
    listPayables: vi.fn(),
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
  planFeatures: { contabilidad: true, 'cuentas-pagar': false },
};

/** @description Builds an authenticated mobile payables request with filters. */
function payablesRequest(): NextRequest {
  return new NextRequest(
    'http://localhost/api/mobile/v1/accounting/accounts-payable?search=prov&estado=PENDIENTE&tipo=compra&page=1&limit=10',
    { headers: { authorization: 'Bearer mobile-access' } },
  );
}

describe('mobile accounts payable route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireFeature).mockImplementation(() => undefined);
    vi.mocked(requirePermission).mockImplementation(() => undefined);
  });

  it('returns tenant payables after the contabilidad feature and permission checks', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingAccountsService.listPayables).mockResolvedValue({
      cuentas: [{ cuentaPorPagarId: 'cxp-1' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      metricas: {
        totalCuentas: 1,
        totalFacturado: 100,
        totalPagado: 50,
        totalSaldo: 50,
        cuentasPendientes: 1,
        cuentasPagadas: 0,
      },
    } as never);

    const response = await GET(payablesRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.metricas.totalSaldo).toBe(50);
    expect(requireFeature).toHaveBeenCalledWith(
      mockUser, 'contabilidad', 'consultar las cuentas por pagar existentes',
    );
    expect(requirePermission).toHaveBeenCalledWith(
      mockUser, 'financiero.contabilidad.acceder', 'consultar las cuentas por pagar',
    );
    expect(AccountingAccountsService.listPayables).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      search: 'prov',
      estado: 'PENDIENTE',
      tipo: 'compra',
      page: 1,
      limit: 10,
    });
  });

  it('maps a missing contabilidad feature to a forbidden response', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(requireFeature).mockImplementation(() => {
      throw new ActionError('Tu plan actual no incluye la funcionalidad', 'FEATURE_NOT_AVAILABLE');
    });

    const response = await GET(payablesRequest());
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('FEATURE_NOT_AVAILABLE');
    expect(AccountingAccountsService.listPayables).not.toHaveBeenCalled();
  });

  it('denies payables without the financial accounting permission', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(requirePermission).mockImplementation(() => {
      throw new ActionError('No tienes permisos', 'FORBIDDEN');
    });

    const response = await GET(payablesRequest());
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('FORBIDDEN');
    expect(AccountingAccountsService.listPayables).not.toHaveBeenCalled();
  });
});
