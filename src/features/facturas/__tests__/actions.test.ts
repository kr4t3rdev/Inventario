import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { factura: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() } } }));
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getFacturasAction, getFacturaByIdAction, updateFacturaAction, deleteFacturaAction } from '@/features/facturas/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
const u: AuthenticatedUser = { userId: 'u1', name: 'T', email: 't@t.com', role: 'admin', isActive: true, tenantId: 't1', tenantRole: 'manager' };
describe('Facturas Actions', () => {
  beforeEach(() => vi.clearAllMocks());
  it('lista paginada', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.factura.findMany).mockResolvedValue([]);
    vi.mocked(prisma.factura.count).mockResolvedValue(0);
    const r = await getFacturasAction();
    expect(r.success).toBe(true);
    if (!r.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(r.data.data).toEqual([]);
  });
  it('byId', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.factura.findFirst).mockResolvedValue({ facturaId: 'f1' } as never);
    const r = await getFacturaByIdAction('f1');
    expect(r.success).toBe(true);
    if (!r.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(r.data).toBeDefined();
  });
  it('byId not found', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.factura.findFirst).mockResolvedValue(null);
    const r = await getFacturaByIdAction('fx');
    expect(r.success).toBe(false);
    if (r.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(r.error.code).toBe('NOT_FOUND');
  });
  it('actualiza', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.factura.findFirst).mockResolvedValue({ facturaId: 'f1' } as never);
    vi.mocked(prisma.factura.update).mockResolvedValue({} as never);
    const r = await updateFacturaAction({ facturaId: 'f1', estado: 'PAGADA' });
    expect(r.success).toBe(true);
    if (!r.success) expect.unreachable('Se esperaba que la accion tuviera exito');
  });
  it('elimina', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.factura.findFirst).mockResolvedValue({ facturaId: 'f1' } as never);
    vi.mocked(prisma.factura.delete).mockResolvedValue({} as never);
    const r = await deleteFacturaAction('f1');
    expect(r.success).toBe(true);
    if (!r.success) expect.unreachable('Se esperaba que la accion tuviera exito');
  });
  it('retorna FEATURE_NOT_AVAILABLE cuando el plan no incluye facturacion', async () => {
    const restrictedUser: AuthenticatedUser = { ...u, role: 'regularUser', tenantRole: 'manager', planFeatures: { facturacion: false } };
    vi.mocked(getCurrentUser).mockResolvedValue(restrictedUser);
    const r = await getFacturasAction();
    expect(r.success).toBe(false);
    if (r.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(r.error.code).toBe('FEATURE_NOT_AVAILABLE');
  });
});
