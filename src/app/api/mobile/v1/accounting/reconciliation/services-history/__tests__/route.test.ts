import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-reconciliation-service', () => ({
  AccountingReconciliationService: { getServicesHistory: vi.fn() },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReconciliationService } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { GET } from '../route';

describe('mobile accounting service reconciliation history route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the canonical service history with supported filters', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: { tenantId: 'tenant-1' } } as never);
    vi.mocked(AccountingReconciliationService.getServicesHistory).mockResolvedValue({
      reconciliaciones: [{ reconciliacionId: 'r-1' }], estadisticas: {}, pagination: {},
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/reconciliation/services-history?fechaDesde=2026-01-01&fechaHasta=2026-01-31&cuentaId=c-1',
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reconciliaciones).toHaveLength(1);
    expect(AccountingReconciliationService.getServicesHistory).toHaveBeenCalledWith({
      tenantId: 'tenant-1', fechaDesde: '2026-01-01', fechaHasta: '2026-01-31', cuentaId: 'c-1',
    });
  });
});
