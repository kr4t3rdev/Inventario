import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-reports-service', () => ({
  AccountingReportsService: { getClientAccountAnalysisReport: vi.fn() },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import { GET } from '../route';

const baseUser = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', role: 'seller', planFeatures: { contabilidad: true, facturacion: true },
};

describe('mobile client account analysis report route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/reports/client-account-analysis?clienteId=c1'));
    expect(response.status).toBe(401);
  });

  it('returns 400 when clienteId is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: baseUser } as never);

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/reports/client-account-analysis'));
    expect(response.status).toBe(400);
  });

  it('returns 403 when user lacks facturacion feature and is not admin', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: { ...baseUser, planFeatures: { contabilidad: true } } } as never);

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/reports/client-account-analysis?clienteId=c1'));
    expect(response.status).toBe(403);
  });

  it('returns client account analysis from shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: baseUser } as never);
    vi.mocked(AccountingReportsService.getClientAccountAnalysisReport).mockResolvedValue({
      clienteId: 'c1',
      estadisticas: { totalDeuda: 100, totalVencido: 20, facturasPendientes: 1, pagosParciales: 0 },
      cuentasPendientes: [{ id: 'cc-1' }],
      historialFacturas: [{ idFactura: 'f1', numeroFactura: 'FAC-1' }],
      ultimaActividad: '2026-01-31T00:00:00.000Z',
    } as never);

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/reports/client-account-analysis?clienteId=c1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cuentasPendientes).toHaveLength(1);
    expect(AccountingReportsService.getClientAccountAnalysisReport).toHaveBeenCalledWith({ tenantId: 'tenant-1', clienteId: 'c1' });
  });
});
