import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const mockTx = { licencia: { create: vi.fn() }, user: { update: vi.fn() } };
vi.mock('@/lib/prisma', () => ({ prisma: { licencia: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() }, plan: { findUnique: vi.fn() }, user: { findUnique: vi.fn() }, $transaction: vi.fn((cb: any) => cb(mockTx)) } }));
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getLicenciasAction, createLicenciaAction, deleteLicenciaAction } from '@/features/licencias/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
const admin: AuthenticatedUser = { userId: 'u1', name: 'A', email: 'a@t.com', role: 'admin', isActive: true, tenantId: 't1', tenantRole: 'admin' };
describe('Licencias Actions', () => {
  beforeEach(() => vi.clearAllMocks());
  it('lista (admin)', async () => { vi.mocked(getCurrentUser).mockResolvedValue(admin); vi.mocked(prisma.licencia.findMany).mockResolvedValue([]); const r=await getLicenciasAction(); expect(r.success).toBe(true); });
  it('no-admin rechazado', async () => { vi.mocked(getCurrentUser).mockResolvedValue({...admin,role:'user'}); const r=await getLicenciasAction(); expect(r.success).toBe(false); expect(r.error!.code).toBe('FORBIDDEN'); });
  it('crea licencia', async () => { vi.mocked(getCurrentUser).mockResolvedValue(admin); vi.mocked(prisma.plan.findUnique).mockResolvedValue({planId:'p1',duracionDias:30}); vi.mocked(prisma.user.findUnique).mockResolvedValue({userId:'u2'}); mockTx.licencia.create.mockResolvedValue({licenciaId:'l1'}); const r=await createLicenciaAction({usuarioId:'u2',planId:'p1'}); expect(r.success).toBe(true); });
  it('elimina licencia', async () => { vi.mocked(getCurrentUser).mockResolvedValue(admin); vi.mocked(prisma.licencia.findUnique).mockResolvedValue({licenciaId:'l1'}); vi.mocked(prisma.licencia.delete).mockResolvedValue({}as any); const r=await deleteLicenciaAction('l1'); expect(r.success).toBe(true); });
});
