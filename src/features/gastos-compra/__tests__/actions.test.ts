import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/lib/prisma', () => ({ prisma: { gastoCompra: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() } } }));
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getGastosCompraAction, getGastoCompraStatsAction } from '@/features/gastos-compra/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
const u: AuthenticatedUser = { userId: 'u1', name: 'T', email: 't@t.com', role: 'admin', isActive: true, tenantId: 't1', tenantRole: 'admin' };
describe('GastosCompra Actions', () => {
  beforeEach(() => vi.clearAllMocks());
  it('lista', async () => { vi.mocked(getCurrentUser).mockResolvedValue(u); vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([]); const r=await getGastosCompraAction(); expect(r.success).toBe(true); });
  it('stats', async () => { vi.mocked(getCurrentUser).mockResolvedValue(u); vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([]); const r=await getGastoCompraStatsAction({}); expect(r.success).toBe(true); });
});
