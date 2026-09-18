import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-reconciliation-service', () => ({
  AccountingReconciliationService: {
    listPendingServices: vi.fn(),
    reconcileService: vi.fn(),
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

describe('mobile accounting reconciliation services route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pending service sales from the shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingReconciliationService.listPendingServices).mockResolvedValue({
      ventaServicios: [{ ventaServicioId: 'vs-1' }],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/reconciliation/services?fechaDesde=2026-01-01&fechaHasta=2026-01-31&page=1&limit=50',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(AccountingReconciliationService.listPendingServices).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      fechaDesde: '2026-01-01',
      fechaHasta: '2026-01-31',
      page: 1,
      limit: 50,
    });
  });

  it('reconciles a service payment distribution', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingReconciliationService.reconcileService).mockResolvedValue({
      reconciliado: true,
      distribuciones: 1,
    } as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/reconciliation/services',
      {
        method: 'POST',
        headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
        body: JSON.stringify({
          ventaServicioId: 'vs-1',
          distribuciones: [
            { cuentaId: 'cb-1', tipoPagoId: 'tp-1', monto: 100, moneda: 'CUP' },
          ],
        }),
      },
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reconciliado).toBe(true);
    expect(AccountingReconciliationService.reconcileService).toHaveBeenCalledWith({
      input: {
        ventaServicioId: 'vs-1',
        distribuciones: [
          { cuentaId: 'cb-1', tipoPagoId: 'tp-1', monto: 100, moneda: 'CUP' },
        ],
      },
      user: mockUser,
    });
  });

  it('maps service reconciliation validation errors to 400', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingReconciliationService.reconcileService).mockRejectedValue(
      new ActionError('Distribución inválida', 'VALIDATION_ERROR'),
    );

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/accounting/reconciliation/services',
      {
        method: 'POST',
        headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
        body: JSON.stringify({
          ventaServicioId: 'vs-1',
          distribuciones: [{ cuentaId: 'cb-1', tipoPagoId: 'tp-1', monto: 100 }],
        }),
      },
    );

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
