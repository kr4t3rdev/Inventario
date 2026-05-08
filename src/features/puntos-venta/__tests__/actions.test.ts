import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { puntoDeVenta: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() } } }));
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getPuntosDeVentaAction, getPuntoDeVentaByIdAction, createPuntoDeVentaAction, deletePuntoDeVentaAction } from '@/features/puntos-venta/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
const u: AuthenticatedUser = { userId: 'u1', name: 'T', email: 't@t.com', role: 'admin', isActive: true, tenantId: 't1', tenantRole: 'admin' };
describe('PV Actions', () => {
  beforeEach(() => vi.clearAllMocks());
  it('lista', async () => { vi.mocked(getCurrentUser).mockResolvedValue(u); vi.mocked(prisma.puntoDeVenta.findMany).mockResolvedValue([]); const r=await getPuntosDeVentaAction(); expect(r.success).toBe(true); });
  it('byId', async () => { vi.mocked(getCurrentUser).mockResolvedValue(u); vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue({pvId:'1'}as any); const r=await getPuntoDeVentaByIdAction('1'); expect(r.success).toBe(true); });
  it('crea', async () => { vi.mocked(getCurrentUser).mockResolvedValue(u); vi.mocked(prisma.puntoDeVenta.create).mockResolvedValue({}as any); const r=await createPuntoDeVentaAction({nombre:'PV 1'}); expect(r.success).toBe(true); });
  it('elimina', async () => { vi.mocked(getCurrentUser).mockResolvedValue(u); vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue({pvId:'1'}); vi.mocked(prisma.puntoDeVenta.delete).mockResolvedValue({}as any); const r=await deletePuntoDeVentaAction('1'); expect(r.success).toBe(true); });
});
