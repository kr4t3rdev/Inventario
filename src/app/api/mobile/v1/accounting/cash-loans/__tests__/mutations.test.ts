import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-cash-operations-mutation-service', () => ({
  AccountingCashOperationsMutationService: {
    createCashLoan: vi.fn(),
    findCashLoanCreateReplay: vi.fn().mockResolvedValue(null),
  },
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
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { 'prestamos-cash': true },
};

describe('mobile cash loans create route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a cash loan for the authenticated tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.createCashLoan).mockResolvedValue({ id: 'prestamo-1' } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        clienteId: 'cli-1', montoCapital: 500, moneda: 'USD', tasaInteres: 12, tasaInteresMoratorio: 24, cuentaBancariaId: 'cb-1', observaciones: 'Loan',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('prestamo-1');
    expect(AccountingCashOperationsMutationService.createCashLoan).toHaveBeenCalledWith({
      input: { clienteId: 'cli-1', montoCapital: 500, moneda: 'USD', tasaInteres: 12, tasaInteresMoratorio: 24, cuentaBancariaId: 'cb-1', observaciones: 'Loan' },
      user: mockUser,
      operationDate: expect.any(Date),
    });
  });

  it('accepts an explicit zero moratory annual rate', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.createCashLoan).mockResolvedValue({ id: 'prestamo-zero' } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        clienteId: 'cli-1', montoCapital: 500, moneda: 'CUP', tasaInteres: 0, tasaInteresMoratorio: 0,
        cuentaBancariaId: 'cb-1',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(AccountingCashOperationsMutationService.createCashLoan).toHaveBeenCalledWith({
      input: expect.objectContaining({ tasaInteres: 0, tasaInteresMoratorio: 0 }),
      user: mockUser,
      operationDate: expect.any(Date),
    });
  });

  it('rejects a missing moratory annual rate before writing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        clienteId: 'cli-1', montoCapital: 500, moneda: 'CUP', tasaInteres: 0, cuentaBancariaId: 'cb-1',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(AccountingCashOperationsMutationService.findCashLoanCreateReplay).not.toHaveBeenCalled();
    expect(AccountingCashOperationsMutationService.createCashLoan).not.toHaveBeenCalled();
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
  });

  it('rejects a missing ordinary annual rate before writing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        clienteId: 'cli-1', montoCapital: 500, moneda: 'CUP', tasaInteresMoratorio: 0,
        cuentaBancariaId: 'cb-1',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(AccountingCashOperationsMutationService.findCashLoanCreateReplay).not.toHaveBeenCalled();
    expect(AccountingCashOperationsMutationService.createCashLoan).not.toHaveBeenCalled();
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
      clienteId: 'cli-1', montoCapital: 500, moneda: 'CUP', tasaInteres: 0,
      tasaInteresMoratorio: 0, cuentaBancariaId: 'cb-1',
    };
    payload[field] = value;

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(AccountingCashOperationsMutationService.findCashLoanCreateReplay).not.toHaveBeenCalled();
    expect(AccountingCashOperationsMutationService.createCashLoan).not.toHaveBeenCalled();
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
  });

  it('replays the authenticated tenant request before validating a closed period', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.findCashLoanCreateReplay)
      .mockResolvedValue({ id: 'prestamo-existing' } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans', {
      method: 'POST',
      headers: {
        authorization: 'Bearer mobile-access',
        'content-type': 'application/json',
        'Idempotency-Key': 'retry-1',
      },
      body: JSON.stringify({
        clienteId: 'cli-1', montoCapital: 500, moneda: 'USD', tasaInteres: 12, tasaInteresMoratorio: 0, cuentaBancariaId: 'cb-1',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('prestamo-existing');
    expect(AccountingCashOperationsMutationService.findCashLoanCreateReplay).toHaveBeenCalledWith({
      input: expect.objectContaining({ idempotencyKey: 'retry-1' }),
      user: mockUser,
    });
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
    expect(AccountingCashOperationsMutationService.createCashLoan).not.toHaveBeenCalled();
  });

});
