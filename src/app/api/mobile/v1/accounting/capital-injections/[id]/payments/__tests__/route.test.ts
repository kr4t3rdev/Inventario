import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-operations-mutation-service', () => ({
  AccountingOperationsMutationService: {
    registerCapitalPayment: vi.fn(),
  },
}));

vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn(() => null),
  validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true, modo: 'enforce' }),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import { AccountingOperationsMutationService } from '@/features/contabilidad/services/accounting-operations-mutation-service';
import { POST } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { contabilidad: true, 'inyeccion-capital': true },
};

describe('mobile capital payment route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a capital payment for the authenticated tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsMutationService.registerCapitalPayment).mockResolvedValue({
      pagoDeudaId: 'pd-1',
      monto: 75,
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/capital-injections/ic-1/payments',
      {
        method: 'POST',
        headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
        body: JSON.stringify({
          monto: 75,
          cuentaBancariaId: 'cb-1',
          tipoPagoId: 'tp-1',
          observaciones: 'Cuota 1',
        }),
      },
    );

    const response = await POST(request, { params: Promise.resolve({ id: 'ic-1' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagoDeudaId).toBe('pd-1');
    expect(AccountingOperationsMutationService.registerCapitalPayment).toHaveBeenCalledWith({
      input: {
        inyeccionId: 'ic-1',
        monto: 75,
        cuentaBancariaId: 'cb-1',
        tipoPagoId: 'tp-1',
        observaciones: 'Cuota 1',
      },
      user: mockUser,
    });
  });

  it('maps payment validation errors to 400', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsMutationService.registerCapitalPayment).mockRejectedValue(
      new ActionError('Pago inválido', 'VALIDATION_ERROR'),
    );

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/capital-injections/ic-1/payments',
      {
        method: 'POST',
        headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
        body: JSON.stringify({
          monto: 75,
          cuentaBancariaId: 'cb-1',
          tipoPagoId: 'tp-1',
        }),
      },
    );

    const response = await POST(request, { params: Promise.resolve({ id: 'ic-1' }) } as never);
    expect(response.status).toBe(400);
  });
});
