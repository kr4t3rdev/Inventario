import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-cash-operations-service', () => ({
  AccountingCashOperationsService: {
    getCashLoanHistory: vi.fn(),
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

describe('mobile cash loan history route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a tenant cash loan history from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsService.getCashLoanHistory).mockResolvedValue({
      prestamo: { id: 'prestamo-1' },
      resumen: { saldoPendiente: 40 },
      historial: [{ id: 'r1' }],
    } as never);

    const response = await GET(
      new Request('http://localhost/api/mobile/v1/accounting/cash-loans/prestamo-1/history', {
        headers: { authorization: 'Bearer mobile-access' },
      }),
      { params: Promise.resolve({ id: 'prestamo-1' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.historial).toHaveLength(1);
    expect(AccountingCashOperationsService.getCashLoanHistory).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      id: 'prestamo-1',
    });
  });
});
