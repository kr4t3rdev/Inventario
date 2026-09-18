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

describe('web accounting report exchange route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/contabilidad/reportes/exchange'));
    expect(response.status).toBe(401);
  });

  it('delegates exchange report generation to shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingReportsService.getExchangeReport).mockResolvedValue({
      historialTasas: [],
      transaccionesConversion: [],
      conversiones: [],
      estadisticasConversion: {},
      filtros: { monedaOrigen: 'USD' },
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/reportes/exchange?fechaInicio=2026-01-01&fechaFin=2026-01-31&monedaOrigen=USD&monedaDestino=CUP'),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.filtros.monedaOrigen).toBe('USD');
    expect(AccountingReportsService.getExchangeReport).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      monedaOrigen: 'USD',
      monedaDestino: 'CUP',
    });
  });

  it('returns 403 when tenant has no multi-moneda access', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        ...mockUser,
        role: 'user',
        planName: 'Básico',
        planFeatures: { contabilidad: true, 'reportes-financieros': true, 'multi-moneda': false },
      },
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/reportes/exchange'),
    );

    expect(response.status).toBe(403);
    expect(AccountingReportsService.getExchangeReport).not.toHaveBeenCalled();
  });
});
