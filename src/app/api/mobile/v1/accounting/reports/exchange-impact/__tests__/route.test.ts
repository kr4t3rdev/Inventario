import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-reports-service', () => ({
  AccountingReportsService: { getExchangeImpactReport: vi.fn() },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import { GET } from '../route';

const mockUser = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', role: 'admin', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { contabilidad: true },
};

describe('mobile accounting reports exchange impact route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/reports/exchange-impact'));
    expect(response.status).toBe(401);
  });

  it('returns exchange impact report from shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingReportsService.getExchangeImpactReport).mockResolvedValue({
      resumen: { gananciaPerdidaTotal: 1250, nivelRiesgo: 'medio' },
      porMoneda: [{ codigo: 'USD', impactoTotal: 1250 }],
      porCuenta: [{ cuentaId: 'cb-1', impactoTotal: 1250 }],
      recomendaciones: [{ titulo: 'Diversificar', prioridad: 'media' }],
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/mobile/v1/accounting/reports/exchange-impact?fechaInicio=2026-01-01&fechaFin=2026-01-31&monedaBase=CUP&tipoAnalisis=general', {
        headers: { authorization: 'Bearer mobile-access' },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.resumen.gananciaPerdidaTotal).toBe(1250);
    expect(AccountingReportsService.getExchangeImpactReport).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      monedaBase: 'CUP',
      tipoAnalisis: 'general',
    });
  });
});
