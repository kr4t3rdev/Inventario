import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-reports-service', () => ({
  AccountingReportsService: { getAdvancesSummaryReport: vi.fn() },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import { GET } from '../route';

const user = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', role: 'admin', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { contabilidad: true },
};

describe('mobile advances summary report route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/advances/reports/summary'));
    expect(response.status).toBe(401);
  });

  it('returns advances summary report from shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);
    vi.mocked(AccountingReportsService.getAdvancesSummaryReport).mockResolvedValue({
      resumen: { porTipo: { PAGO: 100 }, porEstado: { RESERVADO: 1 }, porMoneda: { CUP: { total: 100, pendiente: 80 } }, totalesGenerales: { totalAnticipos: 100, totalEjecutado: 20, totalPendiente: 80 } },
    } as never);

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/advances/reports/summary?tipo=PAGO&fechaInicio=2026-01-01&fechaFin=2026-01-31'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.resumen.totalesGenerales.totalAnticipos).toBe(100);
    expect(AccountingReportsService.getAdvancesSummaryReport).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      tipo: 'PAGO',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
    });
  });
});
