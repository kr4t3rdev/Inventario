import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-accounts-service', () => ({
  AccountingAccountsService: {
    listPayables: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingAccountsService } from '@/features/contabilidad/services/accounting-accounts-service';
import { GET } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { 'cuentas-pagar': true },
};

describe('mobile accounts payable route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tenant payables from the shared service', async () => {
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

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/accounts-payable?search=prov&estado=PENDIENTE&tipo=compra&page=1&limit=10',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.metricas.totalSaldo).toBe(50);
    expect(AccountingAccountsService.listPayables).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      search: 'prov',
      estado: 'PENDIENTE',
      tipo: 'compra',
      page: 1,
      limit: 10,
    });
  });
});
