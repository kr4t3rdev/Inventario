import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-operations-read-service', () => ({
  AccountingOperationsReadService: {
    getBankAdjustments: vi.fn(),
  },
}));

vi.mock('@/features/contabilidad/services/accounting-operations-mutation-service', () => ({
  AccountingOperationsMutationService: {
    createBankAdjustment: vi.fn(),
    findBankAdjustmentReplay: vi.fn(),
  },
}));

vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn(() => null),
  validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true, modo: 'enforce' }),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingOperationsReadService } from '@/features/contabilidad/services/accounting-operations-read-service';
import { AccountingOperationsMutationService } from '@/features/contabilidad/services/accounting-operations-mutation-service';
import { validarEscrituraPeriodo } from '@/lib/services/validate-period-write';
import { GET, POST } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { contabilidad: true },
};

describe('mobile accounting bank adjustments route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-adjustments');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns bank adjustments from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsReadService.getBankAdjustments).mockResolvedValue({
      ajustes: [{ ajusteId: 'aj-1' }],
      cuentaBancaria: null,
      pagination: { currentPage: 1, totalPages: 1, totalCount: 1, limit: 50, hasNextPage: false, hasPrevPage: false },
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/bank-adjustments?cuentaId=all&tipo=ingreso&fechaInicio=2026-01-01&fechaFin=2026-01-31&page=1&limit=50',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(AccountingOperationsReadService.getBankAdjustments).toHaveBeenCalledWith({
       tenantId: 'tenant-1',
       cuentaId: 'all',
      tipo: 'ingreso',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      page: 1,
      limit: 50,
    });
  });

  it('creates a bank adjustment for the authenticated user', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsMutationService.createBankAdjustment).mockResolvedValue({
      ajuste: { ajusteId: 'aj-1' },
      saldoAnterior: 200,
      saldoNuevo: 150,
      advertenciaSaldoNegativo: false,
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-adjustments', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        cuentaId: 'cb-1',
        tipo: 'egreso',
        monto: 50,
        moneda: 'CUP',
        descripcion: 'Ajuste manual',
        motivo: 'Diferencia de caja',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ajuste.ajusteId).toBe('aj-1');
    expect(AccountingOperationsMutationService.createBankAdjustment).toHaveBeenCalledWith({
      input: {
        cuentaId: 'cb-1',
        tipo: 'egreso',
        monto: 50,
        moneda: 'CUP',
        descripcion: 'Ajuste manual',
        motivo: 'Diferencia de caja',
      },
      user: mockUser,
    });
  });

  it('maps the idempotency key from the body and preserves body precedence over the header', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsMutationService.createBankAdjustment).mockResolvedValue({
      ajuste: { ajusteId: 'aj-idempotent' },
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-adjustments', {
      method: 'POST',
      headers: {
        authorization: 'Bearer mobile-access',
        'content-type': 'application/json',
        'Idempotency-Key': 'header-key',
      },
      body: JSON.stringify({
        cuentaId: 'cb-1',
        tipo: 'egreso',
        monto: 50,
        moneda: 'CUP',
        descripcion: 'Ajuste manual',
        motivo: 'Diferencia de caja',
        idempotencyKey: 'body-key',
      }),
    });

    await POST(request);

    expect(AccountingOperationsMutationService.createBankAdjustment).toHaveBeenCalledWith({
      input: expect.objectContaining({ idempotencyKey: 'body-key' }),
      user: mockUser,
    });
  });

  it('maps the idempotency key from the header when the body omits it', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsMutationService.createBankAdjustment).mockResolvedValue({
      ajuste: { ajusteId: 'aj-header' },
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-adjustments', {
      method: 'POST',
      headers: {
        authorization: 'Bearer mobile-access',
        'content-type': 'application/json',
        'Idempotency-Key': 'header-key',
      },
      body: JSON.stringify({
        cuentaId: 'cb-1',
        tipo: 'egreso',
        monto: 50,
        moneda: 'CUP',
        descripcion: 'Ajuste manual',
        motivo: 'Diferencia de caja',
      }),
    });

    await POST(request);

    expect(AccountingOperationsMutationService.createBankAdjustment).toHaveBeenCalledWith({
      input: expect.objectContaining({ idempotencyKey: 'header-key' }),
      user: mockUser,
    });
  });

  it('returns an identical replay before the period-write guard', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsMutationService.findBankAdjustmentReplay)
      .mockResolvedValue({ ajuste: { ajusteId: 'aj-replayed' } } as never);
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({
      permitido: false,
      error: { code: 'PERIODO_CERRADO', message: 'Período contable cerrado' },
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-adjustments', {
      method: 'POST',
      headers: {
        authorization: 'Bearer mobile-access',
        'content-type': 'application/json',
        'Idempotency-Key': 'closed-period-retry',
      },
      body: JSON.stringify({
        cuentaId: 'cb-1', tipo: 'egreso', monto: 50, moneda: 'CUP',
        descripcion: 'Ajuste manual', motivo: 'Diferencia de caja',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ajuste.ajusteId).toBe('aj-replayed');
    expect(AccountingOperationsMutationService.findBankAdjustmentReplay).toHaveBeenCalledWith({
      input: expect.objectContaining({ idempotencyKey: 'closed-period-retry' }),
      user: mockUser,
    });
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
    expect(AccountingOperationsMutationService.createBankAdjustment).not.toHaveBeenCalled();
  });

  it('preserves the period guard for a new operation', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsMutationService.findBankAdjustmentReplay).mockResolvedValue(null as never);
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({
      permitido: false,
      error: { code: 'PERIODO_CERRADO', message: 'Período contable cerrado' },
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-adjustments', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        cuentaId: 'cb-1', tipo: 'ingreso', monto: 10, moneda: 'CUP',
        descripcion: 'Ajuste nuevo', motivo: 'Diferencia de caja',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('PERIODO_CERRADO');
    expect(AccountingOperationsMutationService.createBankAdjustment).not.toHaveBeenCalled();
  });

  it('preserves the closed-period response for a malformed request without an idempotency key', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({
      permitido: false,
      error: { code: 'PERIODO_CERRADO', message: 'Período contable cerrado' },
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-adjustments', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({ cuentaId: 'cb-1', tipo: 'ingreso' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('PERIODO_CERRADO');
    expect(AccountingOperationsMutationService.findBankAdjustmentReplay).not.toHaveBeenCalled();
    expect(AccountingOperationsMutationService.createBankAdjustment).not.toHaveBeenCalled();
  });

  it('returns 400 when a keyed adjustment payload fails schema validation', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsMutationService.findBankAdjustmentReplay)
      .mockRejectedValueOnce(new ZodError([]));

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-adjustments', {
      method: 'POST',
      headers: {
        authorization: 'Bearer mobile-access',
        'content-type': 'application/json',
        'Idempotency-Key': 'malformed-keyed-request',
      },
      body: JSON.stringify({ cuentaId: 'cb-1', tipo: 'ingreso' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
    expect(AccountingOperationsMutationService.createBankAdjustment).not.toHaveBeenCalled();
  });
});
