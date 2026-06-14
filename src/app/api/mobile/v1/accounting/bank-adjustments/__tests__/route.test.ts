import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

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
  },
}));

vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn(() => null),
  validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true, modo: 'enforce' }),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingOperationsReadService } from '@/features/contabilidad/services/accounting-operations-read-service';
import { AccountingOperationsMutationService } from '@/features/contabilidad/services/accounting-operations-mutation-service';
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
});
