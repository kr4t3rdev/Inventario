import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-cash-operations-mutation-service', () => ({
  AccountingCashOperationsMutationService: {
    registerCashDebtPayment: vi.fn(), findCashDebtPaymentReplay: vi.fn(),
  },
}));
vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn(() => null),
  validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true, modo: 'enforce' }),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { validarEscrituraPeriodo } from '@/lib/services/validate-period-write';
import { extraerFechaDeBody } from '@/lib/services/validate-period-write';
import { ActionError } from '@/lib/server-actions';
import { POST } from '../route';

const mockUser = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', role: 'admin', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { 'deudas-cash': true },
};

describe('mobile cash debt payment route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(extraerFechaDeBody).mockReturnValue(null);
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({ permitido: true, modo: 'enforce' } as never);
  });

  it('prefers the body idempotency key over the header', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.findCashDebtPaymentReplay).mockResolvedValue(null as never);
    vi.mocked(AccountingCashOperationsMutationService.registerCashDebtPayment).mockResolvedValue({} as never);
    const request = new NextRequest('http://localhost/payments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'header-key' },
      body: JSON.stringify({ monto: 50, cuentaId: 'cb-1', tipoPagoId: 'tp-1', idempotencyKey: 'body-key' }),
    });
    await POST(request, { params: Promise.resolve({ id: 'deuda-1' }) } as never);
    expect(AccountingCashOperationsMutationService.findCashDebtPaymentReplay).toHaveBeenCalledWith({
      input: expect.objectContaining({ id: 'deuda-1', idempotencyKey: 'body-key' }), user: mockUser,
    });
  });

  it('uses the header key when the body omits it', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.findCashDebtPaymentReplay).mockResolvedValue(null as never);
    vi.mocked(AccountingCashOperationsMutationService.registerCashDebtPayment).mockResolvedValue({} as never);
    const request = new NextRequest('http://localhost/payments', {
      method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': 'header-key' },
      body: JSON.stringify({ monto: 50, cuentaId: 'cb-1', tipoPagoId: 'tp-1' }),
    });
    await POST(request, { params: Promise.resolve({ id: 'deuda-1' }) } as never);
    expect(AccountingCashOperationsMutationService.findCashDebtPaymentReplay).toHaveBeenCalledWith({
      input: expect.objectContaining({ id: 'deuda-1', idempotencyKey: 'header-key' }), user: mockUser,
    });
  });

  it('replays an identical keyed payment before the closed-period guard', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.findCashDebtPaymentReplay)
      .mockResolvedValue({ reconciliacionId: 'rec-replay' } as never);
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({
      permitido: false, error: { code: 'PERIODO_CERRADO', message: 'Período contable cerrado' },
    } as never);
    const request = new NextRequest('http://localhost/payments', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monto: 50, cuentaId: 'cb-1', tipoPagoId: 'tp-1', idempotencyKey: 'retry-key' }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'deuda-1' }) } as never);
    expect(response.status).toBe(200);
    expect((await response.json()).reconciliacionId).toBe('rec-replay');
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
    expect(AccountingCashOperationsMutationService.registerCashDebtPayment).not.toHaveBeenCalled();
  });

  it('returns 400 for a keyed malformed payment without reaching the period gate', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.findCashDebtPaymentReplay)
      .mockRejectedValue(new ActionError('invalid payment', 'VALIDATION_ERROR'));
    const request = new NextRequest('http://localhost/payments', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monto: 'bad', cuentaId: 'cb-1', tipoPagoId: 'tp-1', idempotencyKey: 'bad-key' }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'deuda-1' }) } as never);
    expect(response.status).toBe(400);
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
  });

  it('treats the URL debt id as authoritative over a body id', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.registerCashDebtPayment).mockResolvedValue({} as never);
    const request = new NextRequest('http://localhost/payments', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'body-debt', monto: 50, cuentaId: 'cb-1', tipoPagoId: 'tp-1' }),
    });
    await POST(request, { params: Promise.resolve({ id: 'url-debt' }) } as never);
    expect(AccountingCashOperationsMutationService.registerCashDebtPayment).toHaveBeenCalledWith({
      input: expect.objectContaining({ id: 'url-debt' }), user: mockUser,
    });
  });

  it('uses the guarded business date in the replay identity', async () => {
    const fechaOperacion = new Date('2026-10-03T12:00:00-04:00');
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(extraerFechaDeBody).mockReturnValue(fechaOperacion);
    vi.mocked(AccountingCashOperationsMutationService.findCashDebtPaymentReplay).mockResolvedValue(null as never);
    vi.mocked(AccountingCashOperationsMutationService.registerCashDebtPayment).mockResolvedValue({} as never);
    const request = new NextRequest('http://localhost/payments', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fechaPago: '2026-10-03T12:00:00-04:00', monto: 50,
        cuentaId: 'cb-1', tipoPagoId: 'tp-1',
        idempotencyKey: 'date-key' }),
    });
    await POST(request, { params: Promise.resolve({ id: 'url-debt' }) } as never);
    expect(AccountingCashOperationsMutationService.findCashDebtPaymentReplay).toHaveBeenCalledWith({
      input: expect.objectContaining({ fechaOperacion }), user: mockUser,
    });
  });

  it('rejects a present falsey non-string idempotency key as malformed', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    const request = new NextRequest('http://localhost/payments', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monto: 50, cuentaId: 'cb-1', tipoPagoId: 'tp-1', idempotencyKey: 0 }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'url-debt' }) } as never);
    expect(response.status).toBe(400);
    expect(AccountingCashOperationsMutationService.findCashDebtPaymentReplay).not.toHaveBeenCalled();
    expect(AccountingCashOperationsMutationService.registerCashDebtPayment).not.toHaveBeenCalled();
  });

  it('rejects a present invalid business-date alias instead of falling back to now', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    const request = new NextRequest('http://localhost/payments', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monto: 50, cuentaId: 'cb-1', tipoPagoId: 'tp-1',
        fechaPago: 'not-a-date', idempotencyKey: 'bad-date-key' }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'url-debt' }) } as never);
    expect(response.status).toBe(400);
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
    expect(AccountingCashOperationsMutationService.findCashDebtPaymentReplay).not.toHaveBeenCalled();
  });

  it('rejects an impossible ISO calendar date instead of accepting JavaScript normalization', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    const request = new NextRequest('http://localhost/payments', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monto: 50, cuentaId: 'cb-1', tipoPagoId: 'tp-1',
        fechaPago: '2026-02-30', idempotencyKey: 'impossible-date-key' }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'url-debt' }) } as never);
    expect(response.status).toBe(400);
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
    expect(AccountingCashOperationsMutationService.findCashDebtPaymentReplay).not.toHaveBeenCalled();
  });

  it('rejects date-times without an explicit timezone', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    const request = new NextRequest('http://localhost/payments', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monto: 50, cuentaId: 'cb-1', tipoPagoId: 'tp-1',
        fechaOperacion: '2026-10-02T10:15:00' }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'deuda-1' }) } as never);
    expect(response.status).toBe(400);
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
  });

  it('rejects keys longer than 64 characters and accepts a 64-character key', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.findCashDebtPaymentReplay).mockResolvedValue(null as never);
    vi.mocked(AccountingCashOperationsMutationService.registerCashDebtPayment)
      .mockResolvedValue({ reconciliacionId: 'r-key-64' } as never);
    const makeRequest = (idempotencyKey: string) => new NextRequest('http://localhost/payments', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monto: 50, cuentaId: 'cb-1', tipoPagoId: 'tp-1', idempotencyKey }),
    });
    const tooLong = await POST(makeRequest('k'.repeat(65)), {
      params: Promise.resolve({ id: 'deuda-1' }),
    } as never);
    expect(tooLong.status).toBe(400);
    expect(AccountingCashOperationsMutationService.findCashDebtPaymentReplay).not.toHaveBeenCalled();

    const accepted = await POST(makeRequest('k'.repeat(64)), {
      params: Promise.resolve({ id: 'deuda-1' }),
    } as never);
    expect(accepted.status).toBe(200);
    expect(AccountingCashOperationsMutationService.findCashDebtPaymentReplay).toHaveBeenCalledWith({
      input: expect.objectContaining({ idempotencyKey: 'k'.repeat(64) }), user: mockUser,
    });
  });

  it('registers a cash debt payment for the authenticated tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.registerCashDebtPayment).mockResolvedValue({ reconciliacionId: 'r-1' } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-debts/deuda-1/payments', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({ monto: 50, cuentaId: 'cb-1', tipoPagoId: 'tp-1', observaciones: 'Cuota 1' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'deuda-1' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reconciliacionId).toBe('r-1');
    expect(AccountingCashOperationsMutationService.registerCashDebtPayment).toHaveBeenCalledWith({
      input: { id: 'deuda-1', monto: 50, cuentaId: 'cb-1', tipoPagoId: 'tp-1', observaciones: 'Cuota 1' },
      user: mockUser,
    });
  });
});
