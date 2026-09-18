import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-reports-service', () => ({
  AccountingReportsService: { getProviderAdvancesReport: vi.fn() },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import { GET } from '../route';

const user = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', role: 'admin', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', planFeatures: { contabilidad: true },
};

describe('mobile provider advances report route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/advances/reports/providers'));
    expect(response.status).toBe(401);
  });

  it('returns grouped provider advances report from shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user } as never);
    vi.mocked(AccountingReportsService.getProviderAdvancesReport).mockResolvedValue({
      proveedores: [{ proveedor: { vendorId: 'p1', nombre: 'Proveedor 1' }, anticipos: [], totales: { totalOriginal: 100, totalEjecutado: 20, totalPendiente: 80 } }],
    } as never);

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/advances/reports/providers?proveedorId=p1&fechaInicio=2026-01-01&fechaFin=2026-01-31'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.proveedores).toHaveLength(1);
    expect(AccountingReportsService.getProviderAdvancesReport).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      proveedorId: 'p1',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
    });
  });
});
