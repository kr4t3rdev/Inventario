import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-reconciliation-service', () => ({
  AccountingReconciliationService: {
    getExpensesHistory: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReconciliationService } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { GET } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
};

describe('mobile accounting reconciliation expenses history route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns expense reconciliation history from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingReconciliationService.getExpensesHistory).mockResolvedValue({
      reconciliaciones: [{ reconciliacionId: 'rg-1' }],
      estadisticas: {},
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/reconciliation/expenses/history?tipoGasto=compra&cuentaId=cb-1&fechaDesde=2026-01-01&fechaHasta=2026-01-31&page=1&limit=50',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(AccountingReconciliationService.getExpensesHistory).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      tipoGasto: 'compra',
      cuentaId: 'cb-1',
      fechaDesde: '2026-01-01',
      fechaHasta: '2026-01-31',
      periodo: null,
      reconciliadoPor: null,
      page: 1,
      limit: 50,
    });
  });
});
