import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ActionError } from '@/lib/server-actions';
import { requireFeature, requirePermission } from '@/lib/services/tenant-scope';

const mocks = vi.hoisted(() => ({
  findCashLoanCreateReplay: vi.fn(),
  findCashDebtCreateReplay: vi.fn(),
  findCashLoanPaymentReplay: vi.fn(),
  findCashDebtPaymentReplay: vi.fn(),
  createCashLoan: vi.fn(),
  createCashDebt: vi.fn(),
  registerCashLoanPayment: vi.fn(),
  registerCashDebtPayment: vi.fn(),
  validatePeriod: vi.fn(),
}));

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: (...args: unknown[]) => unknown) => handler,
  withAuthPost: (handler: (request: NextRequest, context: unknown, user: unknown) => unknown) =>
    (request: NextRequest, context: unknown) => handler(request, context, {
      userId: 'user-1', tenantId: 'tenant-1', tenantRole: 'manager', role: 'user',
      planFeatures: { 'prestamos-cash': true, 'deudas-cash': true },
      permissions: new Set(['financiero.contabilidad.acceder']),
    }),
}));

vi.mock('@/lib/prisma', () => ({ default: {}, prisma: {} }));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: () => 'tenant-1',
  requireFeature: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock('@/lib/services/validate-period-write', () => ({
  validarEscrituraPeriodo: mocks.validatePeriod,
  extraerFechaDeBody: () => null,
}));
vi.mock('@/features/contabilidad/services/accounting-cash-operations-mutation-service', () => ({
  AccountingCashOperationsMutationService: {
    findCashLoanCreateReplay: mocks.findCashLoanCreateReplay,
    findCashDebtCreateReplay: mocks.findCashDebtCreateReplay,
    findCashLoanPaymentReplay: mocks.findCashLoanPaymentReplay,
    findCashDebtPaymentReplay: mocks.findCashDebtPaymentReplay,
    createCashLoan: mocks.createCashLoan,
    createCashDebt: mocks.createCashDebt,
    registerCashLoanPayment: mocks.registerCashLoanPayment,
    registerCashDebtPayment: mocks.registerCashDebtPayment,
  },
}));

describe('legacy cash routes idempotency adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validatePeriod.mockResolvedValue({ permitido: true });
    mocks.findCashLoanCreateReplay.mockResolvedValue({ id: 'loan-replay' });
    mocks.findCashDebtCreateReplay.mockResolvedValue({ id: 'debt-replay' });
    mocks.findCashLoanPaymentReplay.mockResolvedValue({ reconciliacionId: 'loan-payment-replay' });
    mocks.findCashDebtPaymentReplay.mockResolvedValue({ reconciliacionId: 'debt-payment-replay' });
  });

  it('replays a keyed loan creation before the period gate and gives the body key precedence', async () => {
    const { POST } = await import('../prestamos-cash/route');
    const response = await POST(new NextRequest('http://localhost/api/contabilidad/prestamos-cash', {
      method: 'POST',
      headers: { 'idempotency-key': 'header-key' },
      body: JSON.stringify({
        clienteId: 'client-1', montoCapital: 25, cuentaBancariaId: 'bank-1',
        idempotencyKey: ' body-key ',
      }),
    }), {});

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ prestamo: { id: 'loan-replay' } });
    expect(mocks.findCashLoanCreateReplay).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ idempotencyKey: 'body-key' }),
    }));
    expect(mocks.validatePeriod).not.toHaveBeenCalled();
    expect(mocks.createCashLoan).not.toHaveBeenCalled();
  });

  it('replays a keyed debt creation from the header before checking period', async () => {
    const { POST } = await import('../deudas-cash/route');
    const response = await POST(new NextRequest('http://localhost/api/contabilidad/deudas-cash', {
      method: 'POST',
      headers: { 'idempotency-key': ' debt-key ' },
      body: JSON.stringify({ proveedorId: 'vendor-1', montoCapital: 25, cuentaBancariaId: 'bank-1' }),
    }), {});

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ deuda: { id: 'debt-replay' } });
    expect(mocks.findCashDebtCreateReplay).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ idempotencyKey: 'debt-key' }),
    }));
    expect(mocks.validatePeriod).not.toHaveBeenCalled();
    expect(mocks.createCashDebt).not.toHaveBeenCalled();
  });

  it('uses the route loan id as authoritative and resolves a replay before period validation', async () => {
    const { POST } = await import('../prestamos-cash/[id]/pagar/route');
    const response = await POST(new NextRequest('http://localhost/api/contabilidad/prestamos-cash/path-loan/pagar', {
      method: 'POST',
      body: JSON.stringify({ monto: 10, cuentaId: 'bank-1', tipoPagoId: 'cash-1', id: 'body-loan', idempotencyKey: 'loan-pay' }),
    }), { params: Promise.resolve({ id: 'path-loan' }) });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ reconciliacion: { reconciliacionId: 'loan-payment-replay' } });
    expect(mocks.findCashLoanPaymentReplay).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ id: 'path-loan', idempotencyKey: 'loan-pay' }),
    }));
    expect(mocks.validatePeriod).not.toHaveBeenCalled();
    expect(mocks.registerCashLoanPayment).not.toHaveBeenCalled();
  });

  it('resolves a debt payment replay before checking period', async () => {
    const { POST } = await import('../deudas-cash/[id]/pagar/route');
    const response = await POST(new NextRequest('http://localhost/api/contabilidad/deudas-cash/path-debt/pagar', {
      method: 'POST',
      body: JSON.stringify({ monto: 10, cuentaId: 'bank-1', tipoPagoId: 'cash-1', idempotencyKey: 'debt-pay' }),
    }), { params: Promise.resolve({ id: 'path-debt' }) });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ reconciliacion: { reconciliacionId: 'debt-payment-replay' } });
    expect(mocks.findCashDebtPaymentReplay).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ id: 'path-debt', idempotencyKey: 'debt-pay' }),
    }));
    expect(mocks.validatePeriod).not.toHaveBeenCalled();
    expect(mocks.registerCashDebtPayment).not.toHaveBeenCalled();
  });

  it('maps a keyed create payload conflict to 409 before period validation', async () => {
    mocks.findCashLoanCreateReplay.mockRejectedValueOnce(new ActionError(
      'La clave de idempotencia ya fue usada con datos diferentes', 'IDEMPOTENCY_CONFLICT',
    ));
    const { POST } = await import('../prestamos-cash/route');
    const response = await POST(new NextRequest('http://localhost/api/contabilidad/prestamos-cash', {
      method: 'POST',
      body: JSON.stringify({ clienteId: 'client-1', montoCapital: 25, cuentaBancariaId: 'bank-1', idempotencyKey: 'conflict-key' }),
    }), {});

    expect(response.status).toBe(409);
    expect(mocks.validatePeriod).not.toHaveBeenCalled();
    expect(mocks.createCashLoan).not.toHaveBeenCalled();
  });

  it('rejects blank or overlong keys at the route boundary', async () => {
    const { POST } = await import('../deudas-cash/route');
    for (const idempotencyKey of ['', 'k'.repeat(65)]) {
      const response = await POST(new NextRequest('http://localhost/api/contabilidad/deudas-cash', {
        method: 'POST',
        body: JSON.stringify({ proveedorId: 'vendor-1', montoCapital: 25, cuentaBancariaId: 'bank-1', idempotencyKey }),
      }), {});
      expect(response.status).toBe(400);
    }
    expect(mocks.findCashDebtCreateReplay).not.toHaveBeenCalled();
  });

  it('passes the exact period-gated timestamp to each keyed canonical writer', async () => {
    mocks.findCashLoanCreateReplay.mockResolvedValue(null);
    mocks.findCashDebtCreateReplay.mockResolvedValue(null);
    mocks.findCashLoanPaymentReplay.mockResolvedValue(null);
    mocks.findCashDebtPaymentReplay.mockResolvedValue(null);
    mocks.createCashLoan.mockResolvedValue({ id: 'loan-new' });
    mocks.createCashDebt.mockResolvedValue({ id: 'debt-new' });
    mocks.registerCashLoanPayment.mockResolvedValue({ reconciliacionId: 'loan-payment-new' });
    mocks.registerCashDebtPayment.mockResolvedValue({ reconciliacionId: 'debt-payment-new' });

    const loanCreateRoute = await import('../prestamos-cash/route');
    await loanCreateRoute.POST(new NextRequest('http://localhost/api/contabilidad/prestamos-cash', {
      method: 'POST',
      body: JSON.stringify({ clienteId: 'client-1', montoCapital: 25,
        cuentaBancariaId: 'bank-1', idempotencyKey: 'create-loan-new' }),
    }), {});
    expect(mocks.createCashLoan.mock.calls[0][0].operationDate)
      .toBe(mocks.validatePeriod.mock.calls[0][0].fecha);

    const debtCreateRoute = await import('../deudas-cash/route');
    await debtCreateRoute.POST(new NextRequest('http://localhost/api/contabilidad/deudas-cash', {
      method: 'POST',
      body: JSON.stringify({ proveedorId: 'vendor-1', montoCapital: 25,
        cuentaBancariaId: 'bank-1', idempotencyKey: 'create-debt-new',
        createdAt: '2020-01-01T00:00:00.000Z' }),
    }), {});
    expect(mocks.createCashDebt.mock.calls[0][0].operationDate)
      .toBe(mocks.validatePeriod.mock.calls[1][0].fecha);
    expect(mocks.validatePeriod.mock.calls[1][0].fecha.toISOString())
      .not.toBe('2020-01-01T00:00:00.000Z');

    const loanPaymentRoute = await import('../prestamos-cash/[id]/pagar/route');
    await loanPaymentRoute.POST(new NextRequest('http://localhost/api/contabilidad/prestamos-cash/loan-1/pagar', {
      method: 'POST',
      body: JSON.stringify({ monto: 10, cuentaId: 'bank-1', tipoPagoId: 'cash-1',
        idempotencyKey: 'loan-payment-new' }),
    }), { params: Promise.resolve({ id: 'loan-1' }) });
    expect(mocks.registerCashLoanPayment.mock.calls[0][0].operationDate)
      .toBe(mocks.validatePeriod.mock.calls[2][0].fecha);

    const debtPaymentRoute = await import('../deudas-cash/[id]/pagar/route');
    await debtPaymentRoute.POST(new NextRequest('http://localhost/api/contabilidad/deudas-cash/debt-1/pagar', {
      method: 'POST',
      body: JSON.stringify({ monto: 10, cuentaId: 'bank-1', tipoPagoId: 'cash-1',
        idempotencyKey: 'debt-payment-new' }),
    }), { params: Promise.resolve({ id: 'debt-1' }) });
    expect(mocks.registerCashDebtPayment.mock.calls[0][0].operationDate)
      .toBe(mocks.validatePeriod.mock.calls[3][0].fecha);
  });

  it('blocks a new keyed debt create in the current closed period despite an old date alias', async () => {
    mocks.findCashDebtCreateReplay.mockResolvedValue(null);
    mocks.validatePeriod.mockResolvedValueOnce({
      permitido: false,
      error: { message: 'Período contable cerrado', code: 'PERIODO_CERRADO' },
    });
    const { POST } = await import('../deudas-cash/route');
    const response = await POST(new NextRequest('http://localhost/api/contabilidad/deudas-cash', {
      method: 'POST',
      body: JSON.stringify({ proveedorId: 'vendor-1', montoCapital: 25,
        cuentaBancariaId: 'bank-1', idempotencyKey: 'new-debt-key',
        createdAt: '2020-01-01T00:00:00.000Z' }),
    }), {});

    expect(response.status).toBe(400);
    expect(mocks.validatePeriod.mock.calls[0][0].fecha.toISOString())
      .not.toBe('2020-01-01T00:00:00.000Z');
    expect(mocks.createCashDebt).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'loan creation',
      load: () => import('../prestamos-cash/route'),
      replay: mocks.findCashLoanCreateReplay,
      writer: mocks.createCashLoan,
      path: '/api/contabilidad/prestamos-cash',
      body: { clienteId: 'client-1', montoCapital: 25, cuentaBancariaId: 'bank-1', idempotencyKey: 'race-loan' },
      invoke: (route: { POST: (request: NextRequest, context: unknown) => Promise<Response> }, request: NextRequest) => route.POST(request, {}),
      result: { prestamo: { id: 'loan-created-by-concurrent-request' } },
    },
    {
      name: 'debt creation',
      load: () => import('../deudas-cash/route'),
      replay: mocks.findCashDebtCreateReplay,
      writer: mocks.createCashDebt,
      path: '/api/contabilidad/deudas-cash',
      body: { proveedorId: 'vendor-1', montoCapital: 25, cuentaBancariaId: 'bank-1', idempotencyKey: 'race-debt' },
      invoke: (route: { POST: (request: NextRequest, context: unknown) => Promise<Response> }, request: NextRequest) => route.POST(request, {}),
      result: { deuda: { id: 'debt-created-by-concurrent-request' } },
    },
    {
      name: 'loan payment',
      load: () => import('../prestamos-cash/[id]/pagar/route'),
      replay: mocks.findCashLoanPaymentReplay,
      writer: mocks.registerCashLoanPayment,
      path: '/api/contabilidad/prestamos-cash/loan-1/pagar',
      body: { monto: 10, cuentaId: 'bank-1', tipoPagoId: 'cash-1', idempotencyKey: 'race-loan-payment' },
      invoke: (route: { POST: (request: NextRequest, context: unknown) => Promise<Response> }, request: NextRequest) => route.POST(request, { params: Promise.resolve({ id: 'loan-1' }) }),
      result: { reconciliacion: { reconciliacionId: 'loan-payment-created-concurrently' } },
    },
    {
      name: 'debt payment',
      load: () => import('../deudas-cash/[id]/pagar/route'),
      replay: mocks.findCashDebtPaymentReplay,
      writer: mocks.registerCashDebtPayment,
      path: '/api/contabilidad/deudas-cash/debt-1/pagar',
      body: { monto: 10, cuentaId: 'bank-1', tipoPagoId: 'cash-1', idempotencyKey: 'race-debt-payment' },
      invoke: (route: { POST: (request: NextRequest, context: unknown) => Promise<Response> }, request: NextRequest) => route.POST(request, { params: Promise.resolve({ id: 'debt-1' }) }),
      result: { reconciliacion: { reconciliacionId: 'debt-payment-created-concurrently' } },
    },
  ])('replays a $name that commits after the initial lookup but before a denied period gate', async (scenario) => {
    scenario.replay.mockResolvedValueOnce(null).mockResolvedValueOnce(
      Object.values(scenario.result)[0],
    );
    mocks.validatePeriod.mockResolvedValueOnce({
      permitido: false,
      error: { message: 'Período contable cerrado', code: 'PERIODO_CERRADO' },
    });
    const route = await scenario.load();
    const response = await scenario.invoke(route, new NextRequest(`http://localhost${scenario.path}`, {
      method: 'POST', body: JSON.stringify(scenario.body),
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(scenario.result);
    expect(scenario.replay).toHaveBeenCalledTimes(2);
    expect(mocks.validatePeriod).toHaveBeenCalledTimes(1);
    expect(scenario.writer).not.toHaveBeenCalled();
    expect(requireFeature).toHaveBeenCalled();
    expect(requirePermission).toHaveBeenCalled();
  });

  it('returns 409 when the post-gate replay lookup finds the key with a different payload', async () => {
    mocks.findCashDebtPaymentReplay.mockResolvedValueOnce(null).mockRejectedValueOnce(
      new ActionError('La clave de idempotencia ya fue usada con datos diferentes', 'IDEMPOTENCY_CONFLICT'),
    );
    mocks.validatePeriod.mockResolvedValueOnce({ permitido: false, error: { code: 'PERIODO_CERRADO' } });
    const { POST } = await import('../deudas-cash/[id]/pagar/route');
    const response = await POST(new NextRequest('http://localhost/api/contabilidad/deudas-cash/debt-1/pagar', {
      method: 'POST',
      body: JSON.stringify({ monto: 11, cuentaId: 'bank-1', tipoPagoId: 'cash-1', idempotencyKey: 'race-conflict' }),
    }), { params: Promise.resolve({ id: 'debt-1' }) });

    expect(response.status).toBe(409);
    expect(mocks.findCashDebtPaymentReplay).toHaveBeenCalledTimes(2);
    expect(mocks.registerCashDebtPayment).not.toHaveBeenCalled();
  });
});
