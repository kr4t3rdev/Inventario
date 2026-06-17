import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-reports-service', () => ({
  AccountingReportsService: { getSummaryReport: vi.fn() },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import { GET } from '../route';

const mockUser = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', role: 'admin', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { contabilidad: true },
};

describe('mobile accounting reports summary route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/reports/summary'));
    expect(response.status).toBe(401);
  });

  it('returns accounting summary report from shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingReportsService.getSummaryReport).mockResolvedValue({
      resumenPorMoneda: [{ moneda: 'CUP', saldoActual: 1000 }],
      estadisticas: { totalCuentas: 1 },
      filtros: { moneda: 'CUP' },
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/mobile/v1/accounting/reports/summary?fechaInicio=2026-01-01&fechaFin=2026-01-31&cuentaId=cb-1&moneda=CUP', {
        headers: { authorization: 'Bearer mobile-access' },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.resumenPorMoneda).toHaveLength(1);
    expect(AccountingReportsService.getSummaryReport).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      cuentaId: 'cb-1',
      moneda: 'CUP',
    });
  });
});
