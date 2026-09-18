import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-reconciliation-service', () => ({
  AccountingReconciliationService: {
    listPendingExpenses: vi.fn(),
  },
}));

vi.mock('@/features/contabilidad/api/reconciliacion-gastos-adapter', () => ({
  reconciliarGastoAdapter: vi.fn(),
}));

vi.mock('@/lib/services/validate-period-write', () => ({
  extraerFechaDeBody: vi.fn(() => null),
  validarEscrituraPeriodo: vi.fn().mockResolvedValue({ permitido: true, modo: 'enforce' }),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReconciliationService } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { reconciliarGastoAdapter } from '@/features/contabilidad/api/reconciliacion-gastos-adapter';
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

describe('mobile accounting reconciliation expenses route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pending expenses from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingReconciliationService.listPendingExpenses).mockResolvedValue({
      gastos: [{ referenciaId: 'g-1' }],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/reconciliation/expenses?tipoGasto=compra&fechaDesde=2026-01-01&fechaHasta=2026-01-31&page=1&limit=50',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(AccountingReconciliationService.listPendingExpenses).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      tipoGasto: 'compra',
      fechaDesde: '2026-01-01',
      fechaHasta: '2026-01-31',
      soloNoReconciliados: true,
      page: 1,
      limit: 50,
    });
  });

  it('reconciles one expense using the canonical adapter', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(reconciliarGastoAdapter).mockResolvedValue({
      reconciliaciones: [{ reconciliacionId: 'rg-1' }],
      cuentaPorPagar: null,
      pagoCuentaPorPagar: null,
      distribucionMultiCuenta: false,
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/reconciliation/expenses',
      {
        method: 'POST',
        headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
        body: JSON.stringify({
          tipoGasto: 'compra',
          gastoCompraId: 'gc-1',
          cuentaId: 'cb-1',
          tipoPagoId: 'tp-1',
          monto: 100,
          moneda: 'CUP',
          descripcion: 'Pago compra',
        }),
      },
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reconciliaciones).toHaveLength(1);
    expect(reconciliarGastoAdapter).toHaveBeenCalledWith(
      {
        tipoGasto: 'compra',
        gastoCompraId: 'gc-1',
        cuentaId: 'cb-1',
        tipoPagoId: 'tp-1',
        monto: 100,
        moneda: 'CUP',
        descripcion: 'Pago compra',
      },
      mockUser,
    );
  });
});
