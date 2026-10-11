import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-cash-operations-service', () => ({
  AccountingCashOperationsService: {
    listCashLoans: vi.fn(),
  },
}));

vi.mock('@/features/contabilidad/services/accounting-cash-operations-mutation-service', () => ({
  AccountingCashOperationsMutationService: {
    createCashLoan: vi.fn(),
    findCashLoanCreateReplay: vi.fn(),
  },
}));

vi.mock('@/lib/services/validate-period-write', () => ({
  validarEscrituraPeriodo: vi.fn(),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingCashOperationsService } from '@/features/contabilidad/services/accounting-cash-operations-service';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
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
  planFeatures: { 'prestamos-cash': true },
};

describe('mobile cash loans route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({ permitido: true } as never);
    vi.mocked(AccountingCashOperationsMutationService.findCashLoanCreateReplay)
      .mockResolvedValue(null as never);
    vi.mocked(AccountingCashOperationsMutationService.createCashLoan)
      .mockResolvedValue({ id: 'loan-1' } as never);
  });

  it('returns tenant cash loans from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsService.listCashLoans).mockResolvedValue({
      prestamos: [{ id: 'prestamo-1' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/cash-loans?estado=ACTIVO&clienteId=cli-1&moneda=USD&page=1&limit=20',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(AccountingCashOperationsService.listCashLoans).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      estado: 'ACTIVO',
      clienteId: 'cli-1',
      moneda: 'USD',
      page: 1,
      limit: 20,
    });
  });

  it('replays an existing create before checking the current period and uses body key precedence', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingCashOperationsMutationService.findCashLoanCreateReplay)
      .mockResolvedValue({ id: 'loan-replayed' } as never);
    vi.mocked(validarEscrituraPeriodo).mockResolvedValue({
      permitido: false,
      error: { message: 'Período cerrado', code: 'PERIODO_CERRADO' },
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'header-key' },
      body: JSON.stringify({ clienteId: 'client-1', montoCapital: 10,
        cuentaBancariaId: 'bank-1', idempotencyKey: ' body-key ' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect((await response.json()).id).toBe('loan-replayed');
    expect(AccountingCashOperationsMutationService.findCashLoanCreateReplay)
      .toHaveBeenCalledWith({
        input: expect.objectContaining({ idempotencyKey: 'body-key' }), user: mockUser,
      });
    expect(validarEscrituraPeriodo).not.toHaveBeenCalled();
    expect(AccountingCashOperationsMutationService.createCashLoan).not.toHaveBeenCalled();
  });

  it('uses a header-only key, ignores client operation-date aliases and passes server date to writer', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': ' header-key ' },
      body: JSON.stringify({ clienteId: 'client-1', montoCapital: 10,
        cuentaBancariaId: 'bank-1', fechaOperacion: '2020-01-01', createdAt: '2020-01-01' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(AccountingCashOperationsMutationService.findCashLoanCreateReplay)
      .toHaveBeenCalledWith({
        input: expect.objectContaining({ idempotencyKey: 'header-key' }), user: mockUser,
      });
    expect(validarEscrituraPeriodo).toHaveBeenCalledWith(expect.objectContaining({
      fecha: expect.any(Date), tipoOperacion: 'prestamo_cash',
    }));
    expect(AccountingCashOperationsMutationService.createCashLoan).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ idempotencyKey: 'header-key' }),
        operationDate: expect.any(Date),
      }),
    );
    const gateDate = vi.mocked(validarEscrituraPeriodo).mock.calls[0][0].fecha;
    const writeDate = vi.mocked(AccountingCashOperationsMutationService.createCashLoan)
      .mock.calls[0][0].operationDate;
    expect(writeDate).toBe(gateDate);
  });

  it.each([0, '', ' '.repeat(1), 'x'.repeat(65)])('rejects invalid body idempotency key %p', async (key) => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'valid-fallback' },
      body: JSON.stringify({ clienteId: 'client-1', montoCapital: 10,
        cuentaBancariaId: 'bank-1', idempotencyKey: key }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(AccountingCashOperationsMutationService.findCashLoanCreateReplay).not.toHaveBeenCalled();
  });
});
