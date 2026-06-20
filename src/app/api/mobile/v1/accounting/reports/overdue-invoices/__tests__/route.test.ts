import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-reports-service', () => ({
  AccountingReportsService: { getOverdueInvoicesReport: vi.fn() },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import { GET } from '../route';

const baseUser = {
  userId: 'u1', name: 'Test User', email: 'test@example.com', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager', role: 'seller', planFeatures: { contabilidad: true, 'facturas-vencidas': true },
};

describe('mobile overdue invoices report route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/reports/overdue-invoices'));
    expect(response.status).toBe(401);
  });

  it('returns 403 when plan does not include overdue invoices and user is not admin', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: { ...baseUser, planFeatures: {}, role: 'seller' } } as never);

    const response = await GET(new NextRequest('http://localhost/api/mobile/v1/accounting/reports/overdue-invoices'));
    expect(response.status).toBe(403);
  });

  it('returns overdue invoices report from shared service', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: baseUser } as never);
    vi.mocked(AccountingReportsService.getOverdueInvoicesReport).mockResolvedValue({
      reporte: [{ clienteId: 'c1', total: 100 }],
      facturas: [{ id: 'f1', numero: 'FAC-1' }],
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/mobile/v1/accounting/reports/overdue-invoices', {
        headers: { authorization: 'Bearer mobile-access' },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.facturas).toHaveLength(1);
    expect(AccountingReportsService.getOverdueInvoicesReport).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
  });
});
