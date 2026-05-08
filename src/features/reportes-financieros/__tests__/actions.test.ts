import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/lib/prisma', () => ({ prisma: { venta: { findMany: vi.fn() }, gastoCompra: { findMany: vi.fn() }, empleado: { findMany: vi.fn() }, merma: { findMany: vi.fn() } } }));
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getReporteFinancieroAction } from '@/features/reportes-financieros/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
const u: AuthenticatedUser = { userId: 'u1', name: 'T', email: 't@t.com', role: 'admin', isActive: true, tenantId: 't1', tenantRole: 'admin' };
describe('Reportes Actions', () => {
  beforeEach(() => vi.clearAllMocks());
  it('genera reporte', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.venta.findMany).mockResolvedValue([]);
    vi.mocked(prisma.gastoCompra.findMany).mockResolvedValue([]);
    vi.mocked(prisma.empleado.findMany).mockResolvedValue([]);
    vi.mocked(prisma.merma.findMany).mockResolvedValue([]);
    const r = await getReporteFinancieroAction({ periodo: '2025-05', tipo: 'mensual' });
    expect(r.success).toBe(true);
    expect(r.data!.resumen.totalVentas).toBe(0);
  });
});
