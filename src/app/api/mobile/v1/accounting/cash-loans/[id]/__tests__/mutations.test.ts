import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-cash-operations-mutation-service', () => ({
  AccountingCashOperationsMutationService: { updateCashLoan: vi.fn() },
}));
vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn(() => null),
  validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true, modo: 'enforce' }),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { PUT } from '../route';

const mockUser = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', role: 'admin', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { 'prestamos-cash': true },
};

describe('mobile cash loan update route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates a cash loan for the authenticated tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.updateCashLoan).mockResolvedValue({ id: 'prestamo-1', observaciones: 'Updated' } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans/prestamo-1', {
      method: 'PUT',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({ observaciones: 'Updated' }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'prestamo-1' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('prestamo-1');
    expect(AccountingCashOperationsMutationService.updateCashLoan).toHaveBeenCalledWith({
      input: { id: 'prestamo-1', observaciones: 'Updated' },
      user: mockUser,
    });
  });
});
