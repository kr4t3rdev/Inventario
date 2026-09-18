import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-reports-service', () => ({
  AccountingReportsService: { getTransfersReport: vi.fn() },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import { GET } from '../route';

const mockUser = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', role: 'admin', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { contabilidad: true },
};

describe('web accounting report transfers route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/contabilidad/reportes/transferencias'));
    expect(response.status).toBe(401);
  });

  it('delegates transfers report generation to shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingReportsService.getTransfersReport).mockResolvedValue({
      transferencias: [],
      estadisticas: { totalTransferencias: 0 },
      paginacion: { page: 1, limit: 50, total: 0, totalPages: 0 },
      filtros: { moneda: 'USD' },
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/reportes/transferencias?fechaInicio=2026-01-01&fechaFin=2026-01-31&cuentaOrigenId=co-1&cuentaDestinoId=cd-1&moneda=USD&page=1&limit=50'),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.filtros.moneda).toBe('USD');
    expect(AccountingReportsService.getTransfersReport).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      cuentaOrigenId: 'co-1',
      cuentaDestinoId: 'cd-1',
      moneda: 'USD',
      page: 1,
      limit: 50,
    });
  });

  it('returns 403 for basic plan users', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        ...mockUser,
        role: 'user',
        planName: 'Básico',
        planFeatures: { contabilidad: true, 'reportes-financieros': true },
      },
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/reportes/transferencias'),
    );

    expect(response.status).toBe(403);
    expect(AccountingReportsService.getTransfersReport).not.toHaveBeenCalled();
  });
});
