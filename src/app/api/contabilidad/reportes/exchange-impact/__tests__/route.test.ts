import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-reports-service', () => ({
  AccountingReportsService: { getExchangeImpactReport: vi.fn() },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import { GET } from '../route';

describe('web accounting report exchange-impact route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/reportes/exchange-impact'),
    );

    expect(response.status).toBe(401);
  });

  it('delegates exchange impact analysis to shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        userId: 'u1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        isActive: true,
        tenantId: 'tenant-1',
        tenantRole: 'manager',
        planFeatures: { contabilidad: true, 'multi-moneda': true, 'reportes-financieros': true },
      },
    } as never);

    vi.mocked(AccountingReportsService.getExchangeImpactReport).mockResolvedValue({
      resumen: { gananciaPerdidaTotal: 500, nivelRiesgo: 'bajo' },
      porMoneda: [],
      porCuenta: [],
      recomendaciones: [],
      filtros: { monedaBase: 'CUP', tipoAnalisis: 'general' },
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/reportes/exchange-impact?fechaInicio=2026-01-01&fechaFin=2026-01-31&monedaBase=CUP&tipoAnalisis=general'),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.resumen.gananciaPerdidaTotal).toBe(500);
    expect(AccountingReportsService.getExchangeImpactReport).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      monedaBase: 'CUP',
      tipoAnalisis: 'general',
    });
  });

  it('returns 403 when tenant has no multi-moneda access', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        userId: 'u1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        tenantId: 'tenant-1',
        tenantRole: 'manager',
        planName: 'Básico',
        planFeatures: { contabilidad: true, 'reportes-financieros': true, 'multi-moneda': false },
      },
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/reportes/exchange-impact'),
    );

    expect(response.status).toBe(403);
    expect(AccountingReportsService.getExchangeImpactReport).not.toHaveBeenCalled();
  });
});
