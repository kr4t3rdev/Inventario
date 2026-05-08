/**
 * @description Tests unitarios para Server Actions de listas de precios.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    listaPrecio: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    puntoDeVenta: {
      count: vi.fn(),
    },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  getListasPreciosAction,
  getListaPrecioByIdAction,
  createListaPrecioAction,
  updateListaPrecioAction,
  deleteListaPrecioAction,
} from '@/features/listas-precios/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'admin',
};

const mockListaRow = {
  id: 'lp-1',
  nombre: 'Precio Base',
  descripcion: null,
  esDefault: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('ListasPrecios Server Actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getListasPreciosAction', () => {
    it('retorna listas del tenant', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.listaPrecio.findMany).mockResolvedValue([{ ...mockListaRow, _count: { puntosDeVenta: 0, precios: 0 } }]);
      const result = await getListasPreciosAction();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getListaPrecioByIdAction', () => {
    it('retorna lista por ID', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.listaPrecio.findFirst).mockResolvedValue({ ...mockListaRow, puntosDeVenta: [] });
      const result = await getListaPrecioByIdAction('lp-1');
      expect(result.success).toBe(true);
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.listaPrecio.findFirst).mockResolvedValue(null);
      const result = await getListaPrecioByIdAction('lp-noexiste');
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  describe('createListaPrecioAction', () => {
    it('crea lista exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.listaPrecio.create).mockResolvedValue(mockListaRow);
      const result = await createListaPrecioAction({ nombre: 'Nueva Lista', esDefault: true });
      expect(result.success).toBe(true);
      expect(prisma.listaPrecio.updateMany).toHaveBeenCalled(); // desactiva otras default
    });
  });

  describe('updateListaPrecioAction', () => {
    it('actualiza lista exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.listaPrecio.findFirst).mockResolvedValue(mockListaRow);
      vi.mocked(prisma.listaPrecio.update).mockResolvedValue(mockListaRow);
      const result = await updateListaPrecioAction({ id: 'lp-1', nombre: 'Actualizado' });
      expect(result.success).toBe(true);
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.listaPrecio.findFirst).mockResolvedValue(null);
      const result = await updateListaPrecioAction({ id: 'lp-noexiste', nombre: 'Test' });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('no encontrada');
    });
  });

  describe('deleteListaPrecioAction', () => {
    it('elimina lista sin puntos de venta', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.listaPrecio.findFirst).mockResolvedValue(mockListaRow);
      vi.mocked(prisma.puntoDeVenta.count).mockResolvedValue(0);
      vi.mocked(prisma.listaPrecio.delete).mockResolvedValue(mockListaRow);
      const result = await deleteListaPrecioAction('lp-1');
      expect(result.success).toBe(true);
    });

    it('rechaza eliminar si está en uso', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.listaPrecio.findFirst).mockResolvedValue(mockListaRow);
      vi.mocked(prisma.puntoDeVenta.count).mockResolvedValue(1);
      const result = await deleteListaPrecioAction('lp-1');
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('LISTA_PRECIO_IN_USE');
    });
  });

  describe('auth requerido', () => {
    it('retorna AUTH_REQUIRED si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const result = await getListasPreciosAction();
      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });
});
