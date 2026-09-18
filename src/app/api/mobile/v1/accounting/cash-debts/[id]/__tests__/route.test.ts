import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-cash-operations-service', () => ({
  AccountingCashOperationsService: {
    getCashDebtById: vi.fn(),
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

describe('mobile cash debt detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a tenant cash debt detail from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsService.getCashDebtById).mockResolvedValue({
      id: 'deuda-1',
    } as never);

    const response = await GET(
      new Request('http://localhost/api/mobile/v1/accounting/cash-debts/deuda-1', {
        headers: { authorization: 'Bearer mobile-access' },
      }),
      { params: Promise.resolve({ id: 'deuda-1' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.item.id).toBe('deuda-1');
    expect(AccountingCashOperationsService.getCashDebtById).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      id: 'deuda-1',
    });
  });
});
