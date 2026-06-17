import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-accounts-service', () => ({
  AccountingAccountsService: {
    getReceivablesMetrics: vi.fn(),
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
  planFeatures: { 'cuentas-cobrar': true },
};

describe('mobile accounts receivable metrics route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tenant receivables metrics from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingAccountsService.getReceivablesMetrics).mockResolvedValue({
      totalPendiente: 100,
      porVencer: 2,
      vencidas: 1,
      totalCuentas: 3,
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/accounts-receivable/metrics',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalPendiente).toBe(100);
    expect(AccountingAccountsService.getReceivablesMetrics).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
    });
  });
});
