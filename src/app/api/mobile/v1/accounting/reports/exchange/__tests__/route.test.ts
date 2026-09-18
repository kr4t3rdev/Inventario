import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-reports-service', () => ({
  AccountingReportsService: { getExchangeReport: vi.fn() },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import { GET } from '../route';

const mockUser = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', role: 'admin', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { contabilidad: true },
};

describe('mobile accounting reports exchange route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/reports/exchange'));
    expect(response.status).toBe(401);
  });

  it('returns exchange report from shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingReportsService.getExchangeReport).mockResolvedValue({
      historialTasas: [{ tasaId: 'tc-1', tasa: 375 }],
      conversiones: [{ id: 'conv-1', tipo: 'venta' }],
      estadisticasConversion: { USD: { totalTransacciones: 1 } },
      filtros: { monedaOrigen: 'USD', monedaDestino: 'CUP' },
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/mobile/v1/accounting/reports/exchange?fechaInicio=2026-01-01&fechaFin=2026-01-31&monedaOrigen=USD&monedaDestino=CUP', {
        headers: { authorization: 'Bearer mobile-access' },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.historialTasas).toHaveLength(1);
    expect(AccountingReportsService.getExchangeReport).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      monedaOrigen: 'USD',
      monedaDestino: 'CUP',
    });
  });
});
