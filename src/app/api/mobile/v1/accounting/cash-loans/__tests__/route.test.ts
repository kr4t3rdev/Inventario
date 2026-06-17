import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-cash-operations-service', () => ({
  AccountingCashOperationsService: {
    listCashLoans: vi.fn(),
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

describe('mobile cash loans route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tenant cash loans from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsService.listCashLoans).mockResolvedValue({
      prestamos: [{ id: 'prestamo-1' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/cash-loans?estado=ACTIVO&clienteId=cli-1&moneda=USD&page=1&limit=20',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(AccountingCashOperationsService.listCashLoans).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      estado: 'ACTIVO',
      clienteId: 'cli-1',
      moneda: 'USD',
      page: 1,
      limit: 20,
    });
  });
});
