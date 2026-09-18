import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-cash-operations-mutation-service', () => ({
  AccountingCashOperationsMutationService: { registerCashLoanPayment: vi.fn() },
}));
vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn(() => null),
  validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true, modo: 'enforce' }),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { POST } from '../route';

const mockUser = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', role: 'admin', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { 'prestamos-cash': true },
};

describe('mobile cash loan payment route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers a cash loan payment for the authenticated tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.registerCashLoanPayment).mockResolvedValue({ reconciliacionId: 'r-1' } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans/prestamo-1/payments', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({ monto: 50, cuentaId: 'cb-1', tipoPagoId: 'tp-1', observaciones: 'Cuota 1' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'prestamo-1' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reconciliacionId).toBe('r-1');
    expect(AccountingCashOperationsMutationService.registerCashLoanPayment).toHaveBeenCalledWith({
      input: { id: 'prestamo-1', monto: 50, cuentaId: 'cb-1', tipoPagoId: 'tp-1', observaciones: 'Cuota 1' },
      user: mockUser,
    });
  });
});
