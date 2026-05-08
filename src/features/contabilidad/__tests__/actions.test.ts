import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/lib/prisma', () => ({ prisma: { reconciliacionVenta: { findMany: vi.fn() }, reconciliacionServicio: { findMany: vi.fn() }, reconciliacionGasto: { findMany: vi.fn() } } }));
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getMovimientosReportAction } from '@/features/contabilidad/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
const u: AuthenticatedUser = { userId: 'u1', name: 'T', email: 't@t.com', role: 'admin', isActive: true, tenantId: 't1', tenantRole: 'admin' };
describe('Contabilidad Actions', () => {
  beforeEach(() => vi.clearAllMocks());
  it('movimientos report', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.reconciliacionVenta.findMany).mockResolvedValue([]);
    vi.mocked(prisma.reconciliacionServicio.findMany).mockResolvedValue([]);
    vi.mocked(prisma.reconciliacionGasto.findMany).mockResolvedValue([]);
    const r = await getMovimientosReportAction({});
    expect(r.success).toBe(true);
    expect(r.data!.data).toEqual([]);
  });
});
