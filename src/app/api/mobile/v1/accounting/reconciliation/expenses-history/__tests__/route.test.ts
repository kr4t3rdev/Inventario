import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-reconciliation-service', () => ({
  AccountingReconciliationService: { getExpensesHistory: vi.fn() },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReconciliationService } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { GET } from '../route';

const user = { userId: 'u1', tenantId: 'tenant-1' };

describe('mobile accounting expense reconciliation history route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns history and forwards the web filters to the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);
    vi.mocked(AccountingReconciliationService.getExpensesHistory).mockResolvedValue({
      reconciliaciones: [{ reconciliacionId: 'r-1' }],
      estadisticas: [],
      pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/reconciliation/expenses-history?tipoGasto=compra&cuentaId=c-1&fechaDesde=2026-01-01&fechaHasta=2026-01-31&periodo=2026-01&reconciliadoPor=u2&page=2&limit=10',
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reconciliaciones).toHaveLength(1);
    expect(AccountingReconciliationService.getExpensesHistory).toHaveBeenCalledWith({
      tenantId: 'tenant-1', tipoGasto: 'compra', cuentaId: 'c-1',
      fechaDesde: '2026-01-01', fechaHasta: '2026-01-31', periodo: '2026-01',
      reconciliadoPor: 'u2', page: 2, limit: 10,
    });
  });
});
