/**
 * @description Tests de la guarda anti-borrado de proveedores (B-03).
 * Antes del fix, `deleteVendorAction` borraba directo y la base de datos
 * hacía cascada: productos, compras y gastos del proveedor desaparecían.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    vendor: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    producto: { count: vi.fn() },
    gastoCompra: { count: vi.fn() },
    compraProducto: { count: vi.fn() },
    compraDocumento: { count: vi.fn() },
    ordenCompra: { count: vi.fn() },
    deudaCash: { count: vi.fn() },
    cuentaPorPagar: { count: vi.fn() },
    anticipo: { count: vi.fn() },
    compraServicio: { count: vi.fn() },
    contrato: { count: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { deleteVendorAction } from '@/features/vendors/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1',
  name: 'Test',
  email: 'test@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-test',
  tenantRole: 'admin',
};

const COUNTS = [
  prisma.producto.count,
  prisma.gastoCompra.count,
  prisma.compraProducto.count,
  prisma.compraDocumento.count,
  prisma.ordenCompra.count,
  prisma.deudaCash.count,
  prisma.cuentaPorPagar.count,
  prisma.anticipo.count,
  prisma.compraServicio.count,
  prisma.contrato.count,
] as const;

describe('deleteVendorAction — guarda anti-cascada (B-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    for (const count of COUNTS) vi.mocked(count as never).mockResolvedValue(0 as never);
    vi.mocked(prisma.vendor.findFirst).mockResolvedValue({ vendorId: 'ven-1' } as never);
    vi.mocked(prisma.vendor.delete).mockResolvedValue({ vendorId: 'ven-1' } as never);
  });

  it('rechaza con error tipado y desglose cuando el proveedor tiene dependencias', async () => {
    vi.mocked(prisma.producto.count).mockResolvedValue(3 as never);
    vi.mocked(prisma.compraDocumento.count).mockResolvedValue(2 as never);
    vi.mocked(prisma.deudaCash.count).mockResolvedValue(1 as never);

    const result = await deleteVendorAction('ven-1');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('PROVEEDOR_EN_USO');
    expect(result.error?.message).toContain('3');
    expect(result.error?.message).toContain('2');
    expect(result.error?.message).toContain('1');
    expect(prisma.vendor.delete).not.toHaveBeenCalled();
  });

  it('cuenta todas las dependencias acotadas al tenant', async () => {
    await deleteVendorAction('ven-1');

    for (const count of COUNTS) {
      const where = vi.mocked(count as never).mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(where.where.tenantId).toBe('tenant-test');
    }
  });

  it('elimina el proveedor sin dependencias', async () => {
    const result = await deleteVendorAction('ven-1');

    expect(result.success).toBe(true);
    expect(prisma.vendor.delete).toHaveBeenCalledWith({ where: { vendorId: 'ven-1' } });
  });

  it('devuelve NOT_FOUND si el proveedor no existe en el tenant', async () => {
    vi.mocked(prisma.vendor.findFirst).mockResolvedValue(null as never);

    const result = await deleteVendorAction('ven-x');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
    expect(prisma.vendor.delete).not.toHaveBeenCalled();
  });
});
