import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-cash-operations-mutation-service', () => ({
  AccountingCashOperationsMutationService: {
    createCashDebt: vi.fn(),
    findCashDebtCreateReplay: vi.fn().mockResolvedValue(null),
  },
}));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireFeature: vi.fn(),
  requirePermission: vi.fn(),
  requireTenant: vi.fn(() => 'tenant-1'),
}));
vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn(() => null),
  validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true, modo: 'enforce' }),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { validarEscrituraPeriodo } from '@/lib/services/validate-period-write';
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
        proveedorId: 'prov-1', montoCapital: 500, moneda: 'CUP', tasaInteres: 12, tasaInteresMoratorio: 24, cuentaBancariaId: 'cb-1', observaciones: 'Debt',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('deuda-1');
    expect(AccountingCashOperationsMutationService.createCashDebt).toHaveBeenCalledWith({
      input: { proveedorId: 'prov-1', montoCapital: 500, moneda: 'CUP', tasaInteres: 12, tasaInteresMoratorio: 24, cuentaBancariaId: 'cb-1', observaciones: 'Debt' },
      user: mockUser,
      operationDate: expect.any(Date),
    });
  });

  it('accepts an explicit zero moratory annual rate', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.createCashDebt).mockResolvedValue({ id: 'deuda-zero' } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-debts', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        proveedorId: 'prov-1', montoCapital: 500, moneda: 'CUP', tasaInteres: 0, tasaInteresMoratorio: 0,
        cuentaBancariaId: 'cb-1',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(AccountingCashOperationsMutationService.createCashDebt).toHaveBeenCalledWith({
      input: expect.objectContaining({ tasaInteres: 0, tasaInteresMoratorio: 0 }),
      user: mockUser,
      operationDate: expect.any(Date),
    });
  });

  it('rejects a missing moratory annual rate before writing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-debts', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        proveedorId: 'prov-1', montoCapital: 500, moneda: 'CUP', tasaInteres: 0, cuentaBancariaId: 'cb-1',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(AccountingCashOperationsMutationService.findCashDebtCreateReplay).not.toHaveBeenCalled();
    expect(AccountingCashOperationsMutationService.createCashDebt).not.toHaveBeenCalled();
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
  });

  it('rejects a missing ordinary annual rate before writing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-debts', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        proveedorId: 'prov-1', montoCapital: 500, moneda: 'CUP', tasaInteresMoratorio: 0,
        cuentaBancariaId: 'cb-1',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(AccountingCashOperationsMutationService.findCashDebtCreateReplay).not.toHaveBeenCalled();
    expect(AccountingCashOperationsMutationService.createCashDebt).not.toHaveBeenCalled();
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
  });

  it.each([
    ['ordinary', 'tasaInteres', null],
    ['ordinary', 'tasaInteres', ''],
    ['moratory', 'tasaInteresMoratorio', null],
    ['moratory', 'tasaInteresMoratorio', ''],
  ])('rejects null or empty %s annual rate before replay or writing', async (_label, field, value) => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    const payload: Record<string, unknown> = {
      proveedorId: 'prov-1', montoCapital: 500, moneda: 'CUP', tasaInteres: 0,
      tasaInteresMoratorio: 0, cuentaBancariaId: 'cb-1',
    };
    payload[field] = value;

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-debts', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(AccountingCashOperationsMutationService.findCashDebtCreateReplay).not.toHaveBeenCalled();
    expect(AccountingCashOperationsMutationService.createCashDebt).not.toHaveBeenCalled();
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
  });

  it('replays a matching retry before rejecting a closed accounting period', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.findCashDebtCreateReplay)
      .mockResolvedValue({ id: 'deuda-existing' } as never);
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({
      permitido: false,
      modo: 'enforce',
      error: { message: 'Período cerrado', code: 'PERIODO_CERRADO' },
    });

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-debts', {
      method: 'POST',
      headers: {
        authorization: 'Bearer mobile-access',
        'content-type': 'application/json',
        'Idempotency-Key': 'debt-retry-1',
      },
      body: JSON.stringify({
        proveedorId: 'prov-1', montoCapital: 500, moneda: 'CUP', tasaInteres: 0, tasaInteresMoratorio: 0, cuentaBancariaId: 'cb-1',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('deuda-existing');
    expect(AccountingCashOperationsMutationService.findCashDebtCreateReplay).toHaveBeenCalledWith({
      input: expect.objectContaining({ idempotencyKey: 'debt-retry-1' }),
      user: mockUser,
    });
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
    expect(AccountingCashOperationsMutationService.createCashDebt).not.toHaveBeenCalled();
  });
});
