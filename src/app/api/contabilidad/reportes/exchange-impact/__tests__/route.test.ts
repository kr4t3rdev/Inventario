import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/features/contabilidad/services/accounting-reports-service', () => ({
  AccountingReportsService: { getExchangeImpactReport: vi.fn() },
}));

import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import { GET } from '../route';

describe('web accounting report exchange-impact route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates exchange impact analysis to shared service preserving current unauthenticated behavior', async () => {
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
      tenantId: '',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      monedaBase: 'CUP',
      tipoAnalisis: 'general',
    });
  });
});
