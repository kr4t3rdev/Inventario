/**
 * @description Tests de listaPrecioId real en clientes y POS (CU-08, RED).
 * @param {void} No aplica - suite de tests
 * @returns {void} Aserciones vitest
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/upload/cloudinary-admin', () => ({ replaceOwnerAsset: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    listaPrecio: { findFirst: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { createClienteAction, updateClienteAction } from '@/features/clientes/actions';
import { getPrecioEfectivo } from '@/lib/types/pricing';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'admin',
};

const userConPlan: AuthenticatedUser = {
  userId: 'user-2', name: 'Plan', email: 'plan@test.com',
  role: 'user', isActive: true, tenantId: 'tenant-test', tenantRole: 'manager',
  planFeatures: { clientes: true },
};

describe('CU-08 listaPrecioId real en clientes (RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.listaPrecio.findFirst).mockResolvedValue({ id: 'lp-1', tenantId: 'tenant-test' } as never);
    vi.mocked(prisma.cliente.create).mockResolvedValue({ clienteId: 'cli-1', listaPrecioId: 'lp-1' } as never);
    vi.mocked(prisma.cliente.update).mockResolvedValue({ clienteId: 'cli-1', listaPrecioId: 'lp-1' } as never);
  });

  it('create persiste listaPrecioId validada por tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

    const result = await createClienteAction({ nombre: 'Cliente VIP', listaPrecioId: 'lp-1' });

    expect(result.success).toBe(true);
    expect(prisma.listaPrecio.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'lp-1', tenantId: 'tenant-test' }) }),
    );
    expect(prisma.cliente.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ listaPrecioId: 'lp-1' }) }),
    );
  });

  it('rechaza lista de otro tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.listaPrecio.findFirst).mockResolvedValue(null as never);

    const result = await createClienteAction({ nombre: 'Cliente X', listaPrecioId: 'lp-otro' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
    expect(prisma.cliente.create).not.toHaveBeenCalled();
  });

  it('exige el feature listas-precios', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userConPlan);

    const result = await createClienteAction({ nombre: 'Cliente Y', listaPrecioId: 'lp-1' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FEATURE_NOT_AVAILABLE');
  });

  it('update persiste listaPrecioId', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: 'cli-1' } as never);

    const result = await updateClienteAction({ clienteId: 'cli-1', listaPrecioId: 'lp-1' });

    expect(result.success).toBe(true);
    expect(prisma.cliente.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ listaPrecioId: 'lp-1' }) }),
    );
  });

  it('el POS resuelve el precio con la lista del cliente tipada', () => {
    const producto = {
      precioVenta: 100,
      precios: [{ listaPrecioId: 'lp-1', precio: 80 }],
    };
    const cliente: { clienteId: string; listaPrecioId: string | null } = { clienteId: 'cli-1', listaPrecioId: 'lp-1' };
    expect(getPrecioEfectivo(producto, cliente.listaPrecioId)).toBe(80);
  });
});
