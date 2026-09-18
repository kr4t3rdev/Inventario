import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-cash-operations-service', () => ({
  AccountingCashOperationsService: {
    getCashLoanStats: vi.fn(),
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
  planFeatures: { 'prestamos-cash': true },
};

describe('mobile cash loans stats route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tenant cash loan stats from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsService.getCashLoanStats).mockResolvedValue({
      totalActivos: 1,
      montoTotalPrestado: { USD: 100 },
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans/stats', {
        headers: { authorization: 'Bearer mobile-access' },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalActivos).toBe(1);
    expect(AccountingCashOperationsService.getCashLoanStats).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
    });
  });
});
