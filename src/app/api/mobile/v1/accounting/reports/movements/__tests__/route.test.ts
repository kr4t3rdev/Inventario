import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-reports-service', () => ({
  AccountingReportsService: { getMovementsReport: vi.fn() },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import { GET } from '../route';

const mockUser = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', role: 'admin', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { contabilidad: true },
};

describe('mobile accounting reports movements route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/reports/movements'));
    expect(response.status).toBe(401);
  });

  it('returns accounting movements report from shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingReportsService.getMovementsReport).mockResolvedValue({
      data: [{ id: 'm-1', tipo: 'venta' }],
      totales: { CUP: { ingresos: 100, egresos: 0, neto: 100 } },
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      filtros: { tipoMovimiento: 'venta' },
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/mobile/v1/accounting/reports/movements?busqueda=test&fechaInicio=2026-01-01&fechaFin=2026-01-31&cuentaId=cb-1&tipoMovimiento=venta&moneda=CUP&page=1&limit=10', {
        headers: { authorization: 'Bearer mobile-access' },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(AccountingReportsService.getMovementsReport).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      busqueda: 'test',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      cuentaId: 'cb-1',
      tipoMovimiento: 'venta',
      moneda: 'CUP',
      page: 1,
      limit: 10,
    });
  });
});
