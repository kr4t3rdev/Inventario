/**
 * @description Tests del guardado anti-cascada al eliminar almacenes (CU-04, RED).
 * @param {void} No aplica - suite de tests
 * @returns {void} Aserciones vitest
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    almacen: { findFirst: vi.fn(), delete: vi.fn() },
    producto: { count: vi.fn() },
    stockUbicacion: { count: vi.fn() },
    transferencia: { count: vi.fn() },
    merma: { count: vi.fn() },
    puntoDeVenta: { count: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { deleteAlmacenAction } from '@/features/almacenes/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'admin',
};

describe('CU-04 guardado anti-cascada de almacenes (RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.almacen.findFirst).mockResolvedValue({ almacenId: 'alm-1' } as never);
    vi.mocked(prisma.producto.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.stockUbicacion.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.transferencia.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.merma.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.puntoDeVenta.count).mockResolvedValue(0 as never);
  });

  it('bloquea el borrado con dependencias y devuelve conteos tipados', async () => {
    vi.mocked(prisma.producto.count).mockResolvedValue(3 as never);
    vi.mocked(prisma.transferencia.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.merma.count).mockResolvedValue(2 as never);
    vi.mocked(prisma.puntoDeVenta.count).mockResolvedValue(1 as never);

    const result = await deleteAlmacenAction('alm-1');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error?.code).toBe('ALMACEN_EN_USO');
      expect(result.error?.message).toContain('3');
    }
    expect(prisma.almacen.delete).not.toHaveBeenCalled();
  });

  it('permite borrar un almacén vacío', async () => {
    vi.mocked(prisma.almacen.delete).mockResolvedValue({ almacenId: 'alm-1' } as never);

    const result = await deleteAlmacenAction('alm-1');

    expect(result.success).toBe(true);
    expect(prisma.almacen.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { almacenId: 'alm-1' } }),
    );
  });
});
