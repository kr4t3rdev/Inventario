import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-reconciliation-service', () => ({
  AccountingReconciliationService: {
    getSalesHistory: vi.fn(),
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

describe('mobile accounting reconciliation sales history route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns sales reconciliation history from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingReconciliationService.getSalesHistory).mockResolvedValue({
      reconciliaciones: [{ reconciliacionId: 'rv-1' }],
      estadisticas: {},
      pagination: {},
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/reconciliation/sales/history?fechaInicio=2026-01-01&fechaFin=2026-01-31&cuentaId=cb-1',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(AccountingReconciliationService.getSalesHistory).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      cuentaId: 'cb-1',
    });
  });
});
