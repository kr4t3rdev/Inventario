import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/features/contabilidad/services/accounting-reports-service', () => ({
  AccountingReportsService: { getMovementsReport: vi.fn() },
}));
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service';
import { getMovimientosReportAction } from '@/features/contabilidad/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
const u: AuthenticatedUser = { userId: 'u1', name: 'T', email: 't@t.com', role: 'admin', isActive: true, tenantId: 't1', tenantRole: 'admin' };
describe('Contabilidad Actions', () => {
  beforeEach(() => vi.clearAllMocks());
  it('movimientos report', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(AccountingReportsService.getMovementsReport).mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      totales: {},
      filtros: {},
      exportContent: null,
      metadatos: {},
    } as never);
    const r = await getMovimientosReportAction({});
    expect(r.success).toBe(true);
    expect(r.data!.data).toEqual([]);
    expect(AccountingReportsService.getMovementsReport).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1' }),
    );
  });
});
