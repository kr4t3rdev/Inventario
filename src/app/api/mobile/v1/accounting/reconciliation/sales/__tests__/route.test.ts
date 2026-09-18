import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-reconciliation-service', () => ({
  AccountingReconciliationService: {
    listPendingSales: vi.fn(),
    reconcileSale: vi.fn(),
  },
}));

vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn(() => null),
  validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true, modo: 'enforce' }),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import { AccountingReconciliationService } from '@/features/contabilidad/services/accounting-reconciliation-service';
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

describe('mobile accounting reconciliation sales route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pending sales from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingReconciliationService.listPendingSales).mockResolvedValue({
      ventas: [{ ventaId: 'v-1' }],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/reconciliation/sales?fechaInicio=2026-01-01&fechaFin=2026-01-31&page=1&limit=50',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(AccountingReconciliationService.listPendingSales).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      puntoDeVentaId: null,
      page: 1,
      limit: 50,
    });
  });

  it('reconciles one sale payment for the authenticated tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingReconciliationService.reconcileSale).mockResolvedValue({
      reconciliacionId: 'rv-1',
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/reconciliation/sales',
      {
        method: 'POST',
        headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
        body: JSON.stringify({
          ventaId: 'v-1',
          cuentaId: 'cb-1',
          tipoPagoId: 'tp-1',
          monto: 100,
          moneda: 'CUP',
        }),
      },
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reconciliacionId).toBe('rv-1');
    expect(AccountingReconciliationService.reconcileSale).toHaveBeenCalledWith({
      input: {
        ventaId: 'v-1',
        cuentaId: 'cb-1',
        tipoPagoId: 'tp-1',
        monto: 100,
        moneda: 'CUP',
      },
      user: mockUser,
    });
  });

  it('maps sale reconciliation validation errors to 400', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingReconciliationService.reconcileSale).mockRejectedValue(
      new ActionError('Monto inválido', 'VALIDATION_ERROR'),
    );

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/reconciliation/sales',
      {
        method: 'POST',
        headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
        body: JSON.stringify({
          ventaId: 'v-1',
          cuentaId: 'cb-1',
          tipoPagoId: 'tp-1',
          monto: 100,
        }),
      },
    );

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
