/**
 * @description Tests de trazabilidad y costo coherente en mermas (CU-07, RED).
 * @param {void} No aplica - suite de tests
 * @returns {void} Aserciones vitest
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/notificaciones-utils', () => ({ notificarMerma: vi.fn() }));
vi.mock('@/lib/services/stock-ubicacion-service', () => ({ upsertStockUbicacion: vi.fn() }));
vi.mock('@/features/inventario/movimientos', () => ({ registrarMovimiento: vi.fn() }));

const { mockTx } = vi.hoisted(() => ({
  mockTx: { merma: { create: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    merma: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    producto: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    stockUbicacion: { findUnique: vi.fn() },
    $transaction: vi.fn((args: any) => (typeof args === 'function' ? args(mockTx) : Promise.all(args))),
    $queryRaw: vi.fn(),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { createMermaAction, updateMermaAction } from '@/features/mermas/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'admin',
};

describe('CU-07 trazabilidad y costo de mermas (RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create persiste creadoPorId del usuario autenticado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.producto.findUnique).mockResolvedValue({
      id: 'prod-1', stock: 50, precioCosto: 1000, tenantId: 'tenant-test', almacenId: 'alm-1',
    } as any);
    vi.mocked(prisma.stockUbicacion.findUnique).mockResolvedValue({ cantidadDisponible: 50 } as any);
    mockTx.merma.create.mockResolvedValue({ mermaId: 'mer-1' } as any);

    const result = await createMermaAction({ productoId: 'prod-1', cantidad: 2, motivo: 'Daño' });

    expect(result.success).toBe(true);
    expect(mockTx.merma.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ creadoPorId: 'user-1', costoTotal: 2000 }),
      }),
    );
  });

  it('update recalcula costoTotal al cambiar cantidad y producto', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.merma.findFirst).mockResolvedValue({
      mermaId: 'mer-1', productoId: 'prod-1', cantidad: 2, tenantId: 'tenant-test', almacenId: 'alm-1',
    } as any);
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-2', almacenId: 'alm-1', precioCosto: 1500,
    } as any);
    vi.mocked(prisma.stockUbicacion.findUnique).mockResolvedValue({ cantidadDisponible: 50 } as any);
    mockTx.merma.update.mockResolvedValue({ mermaId: 'mer-1' } as any);

    const result = await updateMermaAction({ mermaId: 'mer-1', productoId: 'prod-2', cantidad: 4 });

    expect(result.success).toBe(true);
    expect(mockTx.merma.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ costoTotal: 6000 }),
      }),
    );
  });
});
