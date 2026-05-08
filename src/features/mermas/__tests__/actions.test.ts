/**
 * @description Tests unitarios para Server Actions de mermas.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/notificaciones-utils', () => ({ notificarMerma: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    merma: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    producto: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((args: any) => Promise.all(args)),
    $queryRaw: vi.fn(),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { notificarMerma } from '@/lib/notificaciones-utils';
import {
  getMermasAction,
  getMermaByIdAction,
  createMermaAction,
  updateMermaAction,
  deleteMermaAction,
  getMermaStatsAction,
} from '@/features/mermas/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'admin',
};

const mockMermaRow = {
  mermaId: 'mer-1',
  tenantId: 'tenant-test',
  productoId: 'prod-1',
  cantidad: 5,
  motivo: 'Producto dañado',
  createdAt: new Date(),
  updatedAt: new Date(),
  costoTotal: 5000,
  producto: { id: 'prod-1', nombre: 'Producto Test' },
};

const mockProducto = {
  id: 'prod-1',
  stock: 50,
  precioCosto: 1000,
  tenantId: 'tenant-test',
};

describe('Mermas Server Actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getMermasAction', () => {
    it('retorna lista del tenant', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.merma.findMany).mockResolvedValue([mockMermaRow]);
      const result = await getMermasAction();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getMermaByIdAction', () => {
    it('retorna merma por ID', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.merma.findFirst).mockResolvedValue(mockMermaRow);
      const result = await getMermaByIdAction('mer-1');
      expect(result.success).toBe(true);
    });
  });

  describe('createMermaAction', () => {
    it('crea merma y decrementa stock', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findUnique).mockResolvedValue(mockProducto);
      vi.mocked(prisma.merma.create).mockResolvedValue(mockMermaRow);
      vi.mocked(prisma.producto.update).mockResolvedValue({ ...mockProducto, stock: 45 });
      vi.mocked(notificarMerma).mockResolvedValue(undefined);

      const result = await createMermaAction({ productoId: 'prod-1', cantidad: 5, motivo: 'Dañado' });

      expect(result.success).toBe(true);
      expect(notificarMerma).toHaveBeenCalled();
    });

    it('rechaza si el producto no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findUnique).mockResolvedValue(null);

      const result = await createMermaAction({ productoId: 'prod-noexiste', cantidad: 5 });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Producto no encontrado');
    });

    it('rechaza si stock es insuficiente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findUnique).mockResolvedValue({ ...mockProducto, stock: 2 });

      const result = await createMermaAction({ productoId: 'prod-1', cantidad: 5 });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('STOCK_INSUFICIENTE');
    });
  });

  describe('updateMermaAction', () => {
    it('actualiza solo motivo', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.merma.findFirst).mockResolvedValue({ mermaId: 'mer-1', productoId: 'prod-1', cantidad: 5, tenantId: 'tenant-test' });
      vi.mocked(prisma.merma.update).mockResolvedValue(mockMermaRow);

      const result = await updateMermaAction({ mermaId: 'mer-1', motivo: 'Nuevo motivo' });

      expect(result.success).toBe(true);
    });
  });

  describe('deleteMermaAction', () => {
    it('elimina merma y restaura stock', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.merma.findFirst).mockResolvedValue({ mermaId: 'mer-1', productoId: 'prod-1', cantidad: 5 });
      vi.mocked(prisma.merma.delete).mockResolvedValue(mockMermaRow);
      vi.mocked(prisma.producto.update).mockResolvedValue(mockProducto);

      const result = await deleteMermaAction('mer-1');
      expect(result.success).toBe(true);
    });
  });

  describe('getMermaStatsAction', () => {
    it('retorna estadísticas', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.merma.count).mockResolvedValue(10);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      const result = await getMermaStatsAction();
      expect(result.success).toBe(true);
    });
  });

  describe('auth requerido', () => {
    it('retorna AUTH_REQUIRED', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const result = await getMermasAction();
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });
});
