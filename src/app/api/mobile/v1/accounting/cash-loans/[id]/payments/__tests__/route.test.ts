import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-cash-operations-mutation-service', () => ({
  AccountingCashOperationsMutationService: {
    findCashLoanPaymentReplay: vi.fn().mockResolvedValue(null),
    registerCashLoanPayment: vi.fn(),
  },
}));
vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn(() => null),
  validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true, modo: 'enforce' }),
}));
vi.mock('@/lib/services/tenant-scope', () => ({ requireFeature: vi.fn(), requirePermission: vi.fn() }));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { validarEscrituraPeriodo } from '@/lib/services/validate-period-write';
import { requireFeature, requirePermission } from '@/lib/services/tenant-scope';
import { POST } from '../route';

const mockUser = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', role: 'admin', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { 'prestamos-cash': true },
};

describe('mobile cash loan payment route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireFeature).mockImplementation(() => undefined);
    vi.mocked(requirePermission).mockImplementation(() => undefined);
    vi.mocked(AccountingCashOperationsMutationService.findCashLoanPaymentReplay).mockResolvedValue(null as never);
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({ permitido: true, modo: 'enforce' } as never);
  });

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

  it('returns a same-payload retry before a closed-period rejection', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.findCashLoanPaymentReplay)
      .mockResolvedValue({ reconciliacionId: 'original-payment' } as never);
    vi.mocked(validarEscrituraPeriodo)
      .mockResolvedValue({ permitido: false, error: { message: 'closed' }, modo: 'enforce' } as never);
    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans/loan-1/payments', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        monto: 0.0123, cuentaId: 'bank-1', tipoPagoId: 'transfer-1',
        moneda: 'USD', tasaCambio: 300, idempotencyKey: 'retry-1',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'loan-1' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reconciliacionId).toBe('original-payment');
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
    expect(AccountingCashOperationsMutationService.registerCashLoanPayment).not.toHaveBeenCalled();
  });

  it('allows payment of an existing loan after plan downgrade', async () => {
    const { ActionError } = await import('@/lib/server-actions');
    vi.mocked(requireFeature).mockImplementation(() => {
      throw new ActionError('feature unavailable', 'FEATURE_NOT_AVAILABLE');
    });
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans/loan-1/payments', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({ monto: 1, cuentaId: 'bank-1', tipoPagoId: 'transfer-1', idempotencyKey: 'denied' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'loan-1' }) } as never);

    expect(response.status).toBe(200);
    expect(AccountingCashOperationsMutationService.findCashLoanPaymentReplay).toHaveBeenCalledOnce();
    expect(AccountingCashOperationsMutationService.registerCashLoanPayment).toHaveBeenCalledOnce();
  });

  it('denies Cash payment when accounting permission is missing', async () => {
    const { ActionError } = await import('@/lib/server-actions');
    vi.mocked(requirePermission).mockImplementation(() => {
      throw new ActionError('forbidden', 'FORBIDDEN');
    });
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans/loan-1/payments', {
      method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ monto: 1, cuentaId: 'bank-1', tipoPagoId: 'cash-1' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'loan-1' }) } as never);

    expect(response.status).toBe(403);
    expect(AccountingCashOperationsMutationService.registerCashLoanPayment).not.toHaveBeenCalled();
  });

  it('does not let a caller-supplied open date bypass a closed current period', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({
      permitido: false,
      error: { code: 'PERIODO_CERRADO', message: 'closed' },
      modo: 'enforce',
    } as never);
    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans/loan-1/payments', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        monto: 1, cuentaId: 'bank-1', tipoPagoId: 'transfer-1',
        fechaOperacion: '2000-01-15T00:00:00.000Z',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'loan-1' }) } as never);

    expect(response.status).toBe(400);
    expect(validarEscrituraPeriodo).toHaveBeenCalledWith(expect.objectContaining({
      fecha: expect.any(Date),
      tenantId: 'tenant-1',
    }));
    const [periodInput] = vi.mocked(validarEscrituraPeriodo).mock.calls[0];
    expect(periodInput.fecha.getUTCFullYear()).not.toBe(2000);
    expect(AccountingCashOperationsMutationService.registerCashLoanPayment).not.toHaveBeenCalled();
  });
});
