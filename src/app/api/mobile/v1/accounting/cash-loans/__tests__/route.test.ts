import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ActionError } from '@/lib/server-actions';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-cash-operations-service', () => ({
  AccountingCashOperationsService: {
    listCashLoans: vi.fn(),
    getCashLoanById: vi.fn(),
  },
}));

vi.mock('@/features/contabilidad/services/accounting-cash-operations-mutation-service', () => ({
  AccountingCashOperationsMutationService: {
    findCashLoanCreateReplay: vi.fn().mockResolvedValue(null),
    createCashLoan: vi.fn().mockResolvedValue({ id: 'loan-created' }),
    updateCashLoan: vi.fn(),
  },
}));

vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn(() => null),
  validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true }),
}));

vi.mock('@/lib/services/tenant-scope', () => ({
  requireFeature: vi.fn((user: { role?: string; planFeatures?: Record<string, boolean> }, feature: string) => {
    if (user.role !== 'admin' && user.planFeatures?.[feature] !== true) {
      throw new ActionError('Feature unavailable', 'FEATURE_NOT_AVAILABLE');
    }
  }),
  requirePermission: vi.fn((user: { permissionDenied?: boolean }) => {
    if (user.permissionDenied) throw new ActionError('Forbidden', 'FORBIDDEN');
  }),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingCashOperationsService } from '@/features/contabilidad/services/accounting-cash-operations-service';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { requirePermission } from '@/lib/services/tenant-scope';
import { GET, POST } from '../route';
import { GET as GET_DETAIL, PUT as PUT_DETAIL } from '../[id]/route';

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
    expect(requirePermission).toHaveBeenCalledWith(
      mockUser, 'financiero.contabilidad.acceder', 'consultar préstamos cash',
    );
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

  it('requires accounting permission to read existing cash loans', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { ...mockUser, role: 'manager', permissionDenied: true },
    } as never);

    const response = await GET(new NextRequest(
      'http://localhost/api/mobile/v1/accounting/cash-loans',
    ));

    expect(response.status).toBe(403);
    expect(AccountingCashOperationsService.listCashLoans).not.toHaveBeenCalled();
  });

  it('allows reading an existing loan after downgrade with accounting permission', async () => {
    const downgradedUser = {
      ...mockUser,
      role: 'manager',
      planFeatures: { 'prestamos-cash': false },
    };
    vi.mocked(authenticateUser).mockResolvedValue({ user: downgradedUser } as never);
    vi.mocked(AccountingCashOperationsService.getCashLoanById).mockResolvedValue({ id: 'loan-1' } as never);

    const response = await GET_DETAIL(
      new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans/loan-1'),
      { params: Promise.resolve({ id: 'loan-1' }) },
    );

    expect(response.status).toBe(200);
    expect(AccountingCashOperationsService.getCashLoanById).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      id: 'loan-1',
    });
  });

  it('blocks loan edits after downgrade before period validation or writes', async () => {
    const downgradedUser = {
      ...mockUser,
      role: 'manager',
      planFeatures: { 'prestamos-cash': false },
    };
    vi.mocked(authenticateUser).mockResolvedValue({ user: downgradedUser } as never);

    const response = await PUT_DETAIL(
      new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans/loan-1', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ observaciones: 'Updated' }),
      }),
      { params: Promise.resolve({ id: 'loan-1' }) },
    );

    expect(response.status).toBe(403);
    expect(AccountingCashOperationsMutationService.updateCashLoan).not.toHaveBeenCalled();
  });

  it('blocks loan edits without accounting permission', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        ...mockUser,
        role: 'manager',
        permissionDenied: true,
      },
    } as never);

    const response = await PUT_DETAIL(
      new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans/loan-1', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ observaciones: 'Updated' }),
      }),
      { params: Promise.resolve({ id: 'loan-1' }) },
    );

    expect(response.status).toBe(403);
    expect(AccountingCashOperationsMutationService.updateCashLoan).not.toHaveBeenCalled();
  });

  it('blocks Basic from creating a new cash loan and its receivable', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { ...mockUser, role: 'manager', planFeatures: { 'prestamos-cash': false } },
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/cash-loans', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        clienteId: 'client-1', montoCapital: 100, tasaInteres: 0, tasaInteresMoratorio: 0,
        cuentaBancariaId: 'bank-1', idempotencyKey: 'new-loan-key',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(AccountingCashOperationsMutationService.findCashLoanCreateReplay).toHaveBeenCalledOnce();
    expect(AccountingCashOperationsMutationService.createCashLoan).not.toHaveBeenCalled();
  });
});
