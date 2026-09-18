import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/features/contabilidad/services/accounting-reports-service', () => ({
  AccountingReportsService: {
    getSummaryReport: vi.fn(),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import { getResumenFinancieroAction } from '@/features/contabilidad/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const user: AuthenticatedUser = {
  userId: 'user-a',
  name: 'Tenant A',
  email: 'tenant-a@example.com',
  role: 'user',
  isActive: true,
  tenantId: 'tenant-a',
  tenantRole: 'manager',
  planFeatures: {
    contabilidad: true,
    servicios: true,
    'prestamos-cash': true,
    'deudas-cash': true,
  },
};

describe('getResumenFinancieroAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    vi.mocked(AccountingReportsService.getSummaryReport).mockResolvedValue({
      resumenPorMoneda: [],
      cuentasBancarias: [],
      estadisticas: {},
      filtros: {},
      exportContent: null,
      metadatos: {},
    } as never);
  });

  it('delegates to the canonical service with tenant, filters and plan capabilities', async () => {
    const result = await getResumenFinancieroAction({
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      cuentaId: 'account-a',
      moneda: 'CUP',
    });

    expect(result.success).toBe(true);
    expect(AccountingReportsService.getSummaryReport).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      cuentaId: 'account-a',
      moneda: 'CUP',
      includeServicios: true,
      includeTransfers: true,
      includeAdjustments: true,
      includeCapital: false,
      includePrestamosCash: true,
      includeDeudasCash: true,
    });
  });

  it('does not query source documents directly', async () => {
    await getResumenFinancieroAction({});

    expect(AccountingReportsService.getSummaryReport).toHaveBeenCalledTimes(1);
  });
});
