import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-cash-operations-mutation-service', () => ({
  AccountingCashOperationsMutationService: { createCashDebt: vi.fn() },
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
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { 'deudas-cash': true },
};

describe('mobile cash debts create route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a cash debt for the authenticated tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.createCashDebt).mockResolvedValue({ id: 'deuda-1' } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-debts', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        proveedorId: 'prov-1', montoCapital: 500, moneda: 'CUP', cuentaBancariaId: 'cb-1', observaciones: 'Debt',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('deuda-1');
    expect(AccountingCashOperationsMutationService.createCashDebt).toHaveBeenCalledWith({
      input: { proveedorId: 'prov-1', montoCapital: 500, moneda: 'CUP', cuentaBancariaId: 'cb-1', observaciones: 'Debt' },
      user: mockUser,
    });
  });
});
