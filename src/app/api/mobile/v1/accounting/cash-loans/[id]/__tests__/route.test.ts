import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-cash-operations-service', () => ({
  AccountingCashOperationsService: {
    getCashLoanById: vi.fn(),
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

describe('mobile cash loan detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a tenant cash loan detail from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsService.getCashLoanById).mockResolvedValue({
      id: 'prestamo-1',
    } as never);

    const response = await GET(
      new Request('http://localhost/api/mobile/v1/accounting/cash-loans/prestamo-1', {
        headers: { authorization: 'Bearer mobile-access' },
      }),
      { params: Promise.resolve({ id: 'prestamo-1' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.item.id).toBe('prestamo-1');
    expect(AccountingCashOperationsService.getCashLoanById).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      id: 'prestamo-1',
    });
  });
});
