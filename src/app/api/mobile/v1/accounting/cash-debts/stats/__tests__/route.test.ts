import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-cash-operations-service', () => ({
  AccountingCashOperationsService: {
    getCashDebtStats: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingCashOperationsService } from '@/features/contabilidad/services/accounting-cash-operations-service';
import { GET } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { 'deudas-cash': true },
};

describe('mobile cash debts stats route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tenant cash debt stats from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsService.getCashDebtStats).mockResolvedValue({
      totalActivas: 2,
      montoTotalDeuda: { CUP: 200 },
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/mobile/v1/accounting/cash-debts/stats', {
        headers: { authorization: 'Bearer mobile-access' },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalActivas).toBe(2);
    expect(AccountingCashOperationsService.getCashDebtStats).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
    });
  });
});
