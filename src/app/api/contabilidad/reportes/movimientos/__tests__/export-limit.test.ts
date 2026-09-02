import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getMovementsReport = vi.fn().mockResolvedValue({ data: [], totales: {}, pagination: {} });
vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn().mockResolvedValue({ user: { tenantId: 'tenant', planFeatures: {} } }) }));
vi.mock('@/lib/services/tenant-scope', () => ({ requireTenant: vi.fn().mockReturnValue('tenant') }));
vi.mock('@/lib/plan-access', () => ({ canAccessAccountingItem: vi.fn().mockReturnValue(false) }));
vi.mock('@/features/contabilidad/services/accounting-reports-service', () => ({ AccountingReportsService: { getMovementsReport } }));

describe('exportación de movimientos', () => {
  it('rechaza formatos de exportación desconocidos antes de invocar el servicio', async () => {
    const { GET } = await import('../route');

    getMovementsReport.mockClear();
    const response = await GET(new NextRequest(
      'http://localhost/api/contabilidad/reportes/movimientos?formato=xlsx',
    ));

    expect(response.status).toBe(400);
    expect(getMovementsReport).not.toHaveBeenCalled();
  });

  it('limita a 10.000 filas aunque el cliente solicite más', async () => {
    const { GET } = await import('../route');
    await GET(new NextRequest('http://localhost/api/contabilidad/reportes/movimientos?formato=csv&limit=999999'));
    expect(getMovementsReport).toHaveBeenCalledWith(expect.objectContaining({ limit: 10_000 }));
  });
});
