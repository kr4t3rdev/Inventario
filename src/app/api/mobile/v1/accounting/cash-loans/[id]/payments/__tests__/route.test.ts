import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ActionError } from '@/lib/server-actions';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-cash-operations-mutation-service', () => ({
  AccountingCashOperationsMutationService: {
    findCashLoanPaymentReplay: vi.fn().mockResolvedValue(null),
    registerCashLoanPayment: vi.fn(),
  },
}));
vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn((body: Record<string, unknown>) =>
    typeof body.fechaOperacion === 'string' ? new Date(body.fechaOperacion) : null),
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AccountingCashOperationsMutationService.findCashLoanPaymentReplay).mockResolvedValue(null as never);
  });

  it('registers a cash loan payment for the authenticated tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.registerCashLoanPayment).mockResolvedValue({ reconciliacionId: 'r-1' } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans/prestamo-1/payments', {
      method: 'POST',
      headers: {
        authorization: 'Bearer mobile-access',
        'content-type': 'application/json',
        'Idempotency-Key': 'header-key',
      },
      body: JSON.stringify({
        monto: 50,
        cuentaId: 'cb-1',
        tipoPagoId: 'tp-1',
        observaciones: 'Cuota 1',
        idempotencyKey: 'body-key',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'prestamo-1' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reconciliacionId).toBe('r-1');
    expect(AccountingCashOperationsMutationService.registerCashLoanPayment).toHaveBeenCalledWith({
      input: {
        id: 'prestamo-1',
        monto: 50,
        cuentaId: 'cb-1',
        tipoPagoId: 'tp-1',
        observaciones: 'Cuota 1',
        idempotencyKey: 'body-key',
      },
      user: mockUser,
    });
  });

  it('uses the Idempotency-Key header when the body omits a key', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.registerCashLoanPayment).mockResolvedValue({
      reconciliacionId: 'r-2',
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans/prestamo-1/payments', {
      method: 'POST',
      headers: {
        authorization: 'Bearer mobile-access',
        'content-type': 'application/json',
        'Idempotency-Key': 'header-only-key',
      },
      body: JSON.stringify({ monto: 25, cuentaId: 'cb-1', tipoPagoId: 'tp-1' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'prestamo-1' }) } as never);

    expect(response.status).toBe(200);
    expect(AccountingCashOperationsMutationService.registerCashLoanPayment).toHaveBeenCalledWith({
      input: {
        id: 'prestamo-1',
        monto: 25,
        cuentaId: 'cb-1',
        tipoPagoId: 'tp-1',
        idempotencyKey: 'header-only-key',
      },
      user: mockUser,
    });
  });

  it('maps an idempotency payload conflict to HTTP 409', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.registerCashLoanPayment).mockRejectedValue(
      new ActionError('Idempotency key reused with different payload', 'IDEMPOTENCY_CONFLICT'),
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans/prestamo-1/payments', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({ monto: 25, cuentaId: 'cb-1', tipoPagoId: 'tp-1' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'prestamo-1' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('returns a matching replay before checking a closed period and trusts the path loan id', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.findCashLoanPaymentReplay).mockResolvedValue({
      reconciliacionId: 'r-existing',
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans/prestamo-1/payments', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'attacker-loan', monto: 25, cuentaId: 'cb-1', tipoPagoId: 'tp-1',
        idempotencyKey: 'retry-key',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'prestamo-1' }) } as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ reconciliacionId: 'r-existing' });
    expect(AccountingCashOperationsMutationService.findCashLoanPaymentReplay).toHaveBeenCalledWith({
      input: {
        id: 'prestamo-1', monto: 25, cuentaId: 'cb-1', tipoPagoId: 'tp-1',
        idempotencyKey: 'retry-key',
      },
      user: mockUser,
    });
  });

  it('rejects malformed idempotency keys before calling the period gate', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    const { validarEscrituraPeriodo } = await import('@/lib/services/validate-period-write');
    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans/prestamo-1/payments', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({ monto: 25, cuentaId: 'cb-1', tipoPagoId: 'tp-1', idempotencyKey: '  ' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'prestamo-1' }) } as never);

    expect(response.status).toBe(400);
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
  });

  it('passes a validated explicit payment date to replay and persistence', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.registerCashLoanPayment).mockResolvedValue({
      reconciliacionId: 'r-date',
    } as never);
    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans/prestamo-1/payments', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        monto: 25, cuentaId: 'cb-1', tipoPagoId: 'tp-1', idempotencyKey: 'date-key',
        fechaOperacion: '2026-09-30T12:30:00.000Z',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'prestamo-1' }) } as never);

    expect(response.status).toBe(200);
    expect(AccountingCashOperationsMutationService.findCashLoanPaymentReplay).toHaveBeenCalledWith({
      input: expect.objectContaining({ fechaOperacion: new Date('2026-09-30T12:30:00.000Z') }),
      user: mockUser,
    });
    expect(AccountingCashOperationsMutationService.registerCashLoanPayment).toHaveBeenCalledWith({
      input: expect.objectContaining({ fechaOperacion: new Date('2026-09-30T12:30:00.000Z') }),
      user: mockUser,
    });
  });

  it('rejects impossible calendar dates', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    const { validarEscrituraPeriodo } = await import('@/lib/services/validate-period-write');
    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans/prestamo-1/payments', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        monto: 25, cuentaId: 'cb-1', tipoPagoId: 'tp-1', fechaOperacion: '2026-02-30',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'prestamo-1' }) } as never);

    expect(response.status).toBe(400);
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
  });

  it('rejects date-times without an explicit timezone', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    const { validarEscrituraPeriodo } = await import('@/lib/services/validate-period-write');
    const request = new NextRequest('http://localhost/payments', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monto: 25, cuentaId: 'cb-1', tipoPagoId: 'tp-1',
        fechaOperacion: '2026-10-02T10:15:00' }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'prestamo-1' }) } as never);
    expect(response.status).toBe(400);
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
  });

  it('rejects keys longer than 64 characters and accepts a 64-character key', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.registerCashLoanPayment)
      .mockResolvedValue({ reconciliacionId: 'r-key-64' } as never);
    const makeRequest = (idempotencyKey: string) => new NextRequest('http://localhost/payments', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monto: 25, cuentaId: 'cb-1', tipoPagoId: 'tp-1', idempotencyKey }),
    });
    const tooLong = await POST(makeRequest('k'.repeat(65)), {
      params: Promise.resolve({ id: 'prestamo-1' }),
    } as never);
    expect(tooLong.status).toBe(400);
    expect(AccountingCashOperationsMutationService.findCashLoanPaymentReplay).not.toHaveBeenCalled();

    const accepted = await POST(makeRequest('k'.repeat(64)), {
      params: Promise.resolve({ id: 'prestamo-1' }),
    } as never);
    expect(accepted.status).toBe(200);
    expect(AccountingCashOperationsMutationService.findCashLoanPaymentReplay).toHaveBeenCalledWith({
      input: expect.objectContaining({ idempotencyKey: 'k'.repeat(64) }), user: mockUser,
    });
  });
});
