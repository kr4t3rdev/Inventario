import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  withAuthPost: (handler: any) => async (request: NextRequest, context: any) =>
    handler(request, context, { userId: 'user-test', tenantId: 'tenant-1' }),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {},
  default: {},
}));

vi.mock(
  '@/features/contabilidad/services/accounting-cash-operations-mutation-service',
  async (importOriginal) => {
    const original = await importOriginal<any>();
    return {
      ...original,
      AccountingCashOperationsMutationService: {
        ...original.AccountingCashOperationsMutationService,
        findCashLoanPaymentReplay: vi.fn(),
        registerCashLoanPayment: vi.fn(),
      },
    };
  },
);

vi.mock('@/lib/services/validate-period-write', () => ({
  validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true }),
  extraerFechaDeBody: vi.fn(() => undefined),
}));

vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(() => 'tenant-1'),
  requireFeature: vi.fn(),
  requirePermission: vi.fn(),
}));

const mockContext = { params: Promise.resolve({ id: 'p-1' }) };
const payment = {
  monto: 0.0123,
  cuentaId: 'cuenta-1',
  tipoPagoId: 'tp-1',
  moneda: 'USD',
  tasaCambio: 300,
  observaciones: 'partial installment',
};
const reconciliation = { reconciliacionId: 'rec-1', monto: 0.0123, montoConvertido: 3.69 };

describe('API contabilidad/prestamos-cash/[id]/pagar', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const guards = await import('@/lib/services/tenant-scope');
    vi.mocked(guards.requireFeature).mockImplementation(() => undefined);
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH', 'true');
    const service = (await import('@/features/contabilidad/services/accounting-cash-operations-mutation-service'))
      .AccountingCashOperationsMutationService as any;
    service.findCashLoanPaymentReplay.mockResolvedValue(null);
    service.registerCashLoanPayment.mockResolvedValue(reconciliation);
    const period = await import('@/lib/services/validate-period-write');
    vi.mocked(period.validarEscrituraPeriodo).mockResolvedValue({ permitido: true } as any);
  });

  it('writes the exact four-decimal payment through the shared writer', async () => {
    const service = (await import('@/features/contabilidad/services/accounting-cash-operations-mutation-service'))
      .AccountingCashOperationsMutationService as any;
    const { POST } = await import('../route');
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
      method: 'POST',
      body: JSON.stringify({ ...payment, idempotencyKey: 'body-key' }),
      headers: { 'Idempotency-Key': 'header-key' },
    });

    const response = await POST(request, mockContext);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ reconciliacion: reconciliation });
    expect(service.registerCashLoanPayment).toHaveBeenCalledWith({
      input: { id: 'p-1', ...payment, idempotencyKey: 'body-key' },
      user: expect.objectContaining({ userId: 'user-test', tenantId: 'tenant-1' }),
    });
  });

  it('allows settlement of an existing loan when the plan feature is unavailable', async () => {
    const guards = await import('@/lib/services/tenant-scope');
    const { ActionError } = await import('@/lib/server-actions');
    vi.mocked(guards.requireFeature).mockImplementation(() => {
      throw new ActionError('plan downgraded', 'FEATURE_NOT_AVAILABLE');
    });
    const service = (await import('@/features/contabilidad/services/accounting-cash-operations-mutation-service'))
      .AccountingCashOperationsMutationService as any;
    const { POST } = await import('../route');
    const response = await POST(new NextRequest(
      'http://localhost/api/contabilidad/prestamos-cash/p-1/pagar',
      { method: 'POST', body: JSON.stringify(payment) },
    ), mockContext);

    expect(response.status).toBe(201);
    expect(service.registerCashLoanPayment).toHaveBeenCalledOnce();
  });

  it('uses the Idempotency-Key header when the body does not provide a key', async () => {
    const service = (await import('@/features/contabilidad/services/accounting-cash-operations-mutation-service'))
      .AccountingCashOperationsMutationService as any;
    const { POST } = await import('../route');
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
      method: 'POST',
      body: JSON.stringify(payment),
      headers: { 'Idempotency-Key': 'header-key' },
    });

    await POST(request, mockContext);

    expect(service.registerCashLoanPayment).toHaveBeenCalledWith({
      input: { id: 'p-1', ...payment, idempotencyKey: 'header-key' },
      user: expect.any(Object),
    });
  });

  it('replays an exact final payment before a closed-period check', async () => {
    const service = (await import('@/features/contabilidad/services/accounting-cash-operations-mutation-service'))
      .AccountingCashOperationsMutationService as any;
    service.findCashLoanPaymentReplay.mockResolvedValue(reconciliation);
    const period = await import('@/lib/services/validate-period-write');
    vi.mocked(period.validarEscrituraPeriodo).mockResolvedValue({
      permitido: false,
      error: { code: 'PERIODO_CERRADO', message: 'closed' },
    } as any);
    const { POST } = await import('../route');
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
      method: 'POST',
      body: JSON.stringify({ ...payment, idempotencyKey: 'same-key' }),
    });

    const response = await POST(request, mockContext);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ reconciliacion: reconciliation });
    expect(period.validarEscrituraPeriodo).not.toHaveBeenCalled();
    expect(service.registerCashLoanPayment).not.toHaveBeenCalled();
  });

  it('blocks a new payment in a closed period', async () => {
    const service = (await import('@/features/contabilidad/services/accounting-cash-operations-mutation-service'))
      .AccountingCashOperationsMutationService as any;
    const period = await import('@/lib/services/validate-period-write');
    vi.mocked(period.validarEscrituraPeriodo).mockResolvedValue({
      permitido: false,
      error: { code: 'PERIODO_CERRADO', message: 'closed' },
    } as any);
    const { POST } = await import('../route');
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
      method: 'POST',
      body: JSON.stringify({ ...payment, idempotencyKey: 'new-key' }),
    });

    const response = await POST(request, mockContext);

    expect(response.status).toBe(400);
    expect(service.registerCashLoanPayment).not.toHaveBeenCalled();
  });

  it('maps idempotency conflicts and rejects excess decimals before replay lookup', async () => {
    const service = (await import('@/features/contabilidad/services/accounting-cash-operations-mutation-service'))
      .AccountingCashOperationsMutationService as any;
    const { ActionError } = await import('@/lib/server-actions');
    service.findCashLoanPaymentReplay.mockRejectedValue(
      new ActionError('key conflict', 'IDEMPOTENCY_CONFLICT'),
    );
    const { POST } = await import('../route');
    const conflictResponse = await POST(new NextRequest(
      'http://localhost/api/contabilidad/prestamos-cash/p-1/pagar',
      { method: 'POST', body: JSON.stringify({ ...payment, idempotencyKey: 'same-key' }) },
    ), mockContext);
    expect(conflictResponse.status).toBe(409);

    service.findCashLoanPaymentReplay.mockClear();
    const precisionResponse = await POST(new NextRequest(
      'http://localhost/api/contabilidad/prestamos-cash/p-1/pagar',
      { method: 'POST', body: JSON.stringify({ ...payment, monto: 0.01234 }) },
    ), mockContext);
    expect(precisionResponse.status).toBe(400);
    expect(service.findCashLoanPaymentReplay).not.toHaveBeenCalled();
    expect(service.registerCashLoanPayment).not.toHaveBeenCalled();
  });

  it('denies a payment before replay when the permission gate fails', async () => {
    const { ActionError } = await import('@/lib/server-actions');
    const guards = await import('@/lib/services/tenant-scope');
    const service = (await import('@/features/contabilidad/services/accounting-cash-operations-mutation-service'))
      .AccountingCashOperationsMutationService as any;
    vi.mocked(guards.requirePermission)
      .mockImplementation(() => { throw new ActionError('denied', 'FORBIDDEN'); });
    const { POST } = await import('../route');
    const response = await POST(new NextRequest(
      'http://localhost/api/contabilidad/prestamos-cash/p-1/pagar',
      { method: 'POST', body: JSON.stringify({ ...payment, idempotencyKey: 'denied-key' }) },
    ), mockContext);

    expect(response.status).toBe(403);
    expect(service.findCashLoanPaymentReplay).not.toHaveBeenCalled();
    expect(service.registerCashLoanPayment).not.toHaveBeenCalled();
  });
});
