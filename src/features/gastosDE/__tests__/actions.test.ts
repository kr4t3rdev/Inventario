import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { gastosDE: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }, gastoElemento: { findFirst: vi.fn() }, gastoConcepto: { findUnique: vi.fn() } } }));
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getGastosDEAction, createGastosDEAction, deleteGastosDEAction } from '@/features/gastosDE/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
const u: AuthenticatedUser = { userId: 'u1', name: 'T', email: 't@t.com', role: 'admin', isActive: true, tenantId: 't1', tenantRole: 'admin' };
describe('GastosDE Actions', () => {
  beforeEach(() => vi.clearAllMocks());
  it('lista', async () => { vi.mocked(getCurrentUser).mockResolvedValue(u); vi.mocked(prisma.gastosDE.findMany).mockResolvedValue([]); const r=await getGastosDEAction(); expect(r.success).toBe(true); });
  it('crea', async () => { vi.mocked(getCurrentUser).mockResolvedValue(u); vi.mocked(prisma.gastosDE.create).mockResolvedValue({gastosDEId:'g1'}as any); const r=await createGastosDEAction({proveedor:'P1',monto:5000,descripcion:'Test'}); expect(r.success).toBe(true); });
  it('elimina', async () => { vi.mocked(getCurrentUser).mockResolvedValue(u); vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue({gastosDEId:'g1'}); vi.mocked(prisma.gastosDE.delete).mockResolvedValue({}as any); const r=await deleteGastosDEAction('g1'); expect(r.success).toBe(true); });
});
