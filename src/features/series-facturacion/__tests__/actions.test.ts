import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { serieFacturacion: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() } } }));
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getSeriesFacturacionAction, createSerieFacturacionAction, deleteSerieFacturacionAction } from '@/features/series-facturacion/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
const u: AuthenticatedUser = { userId: 'u1', name: 'T', email: 't@t.com', role: 'admin', isActive: true, tenantId: 't1', tenantRole: 'admin' };
describe('Series Actions', () => {
  beforeEach(() => vi.clearAllMocks());
  it('lista', async () => { vi.mocked(getCurrentUser).mockResolvedValue(u); vi.mocked(prisma.serieFacturacion.findMany).mockResolvedValue([]); const r=await getSeriesFacturacionAction(); expect(r.success).toBe(true); });
  it('crea', async () => { vi.mocked(getCurrentUser).mockResolvedValue(u); vi.mocked(prisma.serieFacturacion.findFirst).mockResolvedValue(null); vi.mocked(prisma.serieFacturacion.create).mockResolvedValue({}as any); const r=await createSerieFacturacionAction({prefijo:'A',descripcion:'Test'}); expect(r.success).toBe(true); });
  it('rechaza duplicado', async () => { vi.mocked(getCurrentUser).mockResolvedValue(u); vi.mocked(prisma.serieFacturacion.findFirst).mockResolvedValue({serieId:'1'}); const r=await createSerieFacturacionAction({prefijo:'A',descripcion:'Test'}); expect(r.success).toBe(false); });
  it('elimina', async () => { vi.mocked(getCurrentUser).mockResolvedValue(u); vi.mocked(prisma.serieFacturacion.findFirst).mockResolvedValue({serieId:'1'}); vi.mocked(prisma.serieFacturacion.delete).mockResolvedValue({}as any); const r=await deleteSerieFacturacionAction('1'); expect(r.success).toBe(true); });
  it('retorna FEATURE_NOT_AVAILABLE cuando el plan no incluye series-facturacion', async () => {
    const restrictedUser: AuthenticatedUser = { ...u, role: 'user', tenantRole: 'manager', planFeatures: { 'series-facturacion': false } };
    vi.mocked(getCurrentUser).mockResolvedValue(restrictedUser);
    const r = await getSeriesFacturacionAction();
    expect(r.success).toBe(false);
    expect(r.error!.code).toBe('FEATURE_NOT_AVAILABLE');
  });
});
