/**
 * @description Tests unitarios para Server Actions de almacenes.
 * Sigue TDD estricto: RED → GREEN → REFACTOR.
 *
 * Escenarios cubiertos:
 * - getAlmacenesAction: listado con tenant isolation
 * - getAlmacenByIdAction: obtener por ID con existencia check
 * - createAlmacenAction: creación con validación
 * - updateAlmacenAction: update con existencia check
 * - deleteAlmacenAction: eliminación con existencia check
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mockeamos dependencias ANTES de importar el módulo
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    almacen: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  getAlmacenesAction,
  getAlmacenByIdAction,
  createAlmacenAction,
  updateAlmacenAction,
  deleteAlmacenAction,
} from '@/features/almacenes/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── Helpers ───────────────────────────────────────────────

const mockUser: AuthenticatedUser = {
  userId: 'user-test-1',
  name: 'Test',
  email: 'test@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-test',
  tenantRole: 'admin',
};

const mockAlmacenRow = {
  almacenId: 'alm-1',
  nombre: 'Almacén Principal',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

// ─── Tests ─────────────────────────────────────────────────

describe('Almacenes Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getAlmacenesAction ─────────────────────────────────

  describe('getAlmacenesAction', () => {
    it('retorna lista de almacenes del tenant', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.almacen.findMany).mockResolvedValue([mockAlmacenRow]);

      const result = await getAlmacenesAction();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].nombre).toBe('Almacén Principal');
      expect(prisma.almacen.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-test' }),
        })
      );
    });

    it('retorna lista vacía si no hay almacenes', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.almacen.findMany).mockResolvedValue([]);

      const result = await getAlmacenesAction();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  // ─── getAlmacenByIdAction ───────────────────────────────

  describe('getAlmacenByIdAction', () => {
    it('retorna almacén por ID', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.almacen.findFirst).mockResolvedValue(mockAlmacenRow);

      const result = await getAlmacenByIdAction('alm-1');

      expect(result.success).toBe(true);
      expect(result.data!.nombre).toBe('Almacén Principal');
      expect(prisma.almacen.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { almacenId: 'alm-1', tenantId: 'tenant-test' },
        })
      );
    });

    it('retorna NOT_FOUND si el almacén no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.almacen.findFirst).mockResolvedValue(null);

      const result = await getAlmacenByIdAction('alm-noexiste');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  // ─── createAlmacenAction ────────────────────────────────

  describe('createAlmacenAction', () => {
    const validInput = { nombre: 'Nuevo Almacén' };

    it('crea almacén exitosamente con datos válidos', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.almacen.create).mockResolvedValue(mockAlmacenRow);

      const result = await createAlmacenAction(validInput);

      expect(result.success).toBe(true);
      expect(prisma.almacen.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nombre: 'Nuevo Almacén',
            tenantId: 'tenant-test',
          }),
        })
      );
    });

    it('retorna error de validación si el nombre está vacío', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const result = await createAlmacenAction({ nombre: '' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── updateAlmacenAction ────────────────────────────────

  describe('updateAlmacenAction', () => {
    it('actualiza almacén exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.almacen.findFirst).mockResolvedValue(mockAlmacenRow);
      vi.mocked(prisma.almacen.update).mockResolvedValue({
        ...mockAlmacenRow,
        nombre: 'Almacén Actualizado',
      });

      const result = await updateAlmacenAction({
        almacenId: 'alm-1',
        nombre: 'Almacén Actualizado',
      });

      expect(result.success).toBe(true);
      expect(prisma.almacen.update).toHaveBeenCalled();
    });

    it('retorna NOT_FOUND si el almacén no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.almacen.findFirst).mockResolvedValue(null);

      const result = await updateAlmacenAction({
        almacenId: 'alm-noexiste',
        nombre: 'Nuevo nombre',
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('no encontrado');
    });
  });

  // ─── deleteAlmacenAction ────────────────────────────────

  describe('deleteAlmacenAction', () => {
    it('elimina almacén exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.almacen.findFirst).mockResolvedValue(mockAlmacenRow);
      vi.mocked(prisma.almacen.delete).mockResolvedValue(mockAlmacenRow);

      const result = await deleteAlmacenAction('alm-1');

      expect(result.success).toBe(true);
      expect(prisma.almacen.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { almacenId: 'alm-1' } })
      );
    });

    it('retorna NOT_FOUND si el almacén no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.almacen.findFirst).mockResolvedValue(null);

      const result = await deleteAlmacenAction('alm-noexiste');

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('no encontrado');
    });
  });

  // ─── Auth requerido ─────────────────────────────────────

  describe('auth requerido', () => {
    it('getAlmacenesAction retorna AUTH_REQUIRED si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await getAlmacenesAction();

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });

    it('createAlmacenAction retorna AUTH_REQUIRED si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await createAlmacenAction({ nombre: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });

    it('deleteAlmacenAction retorna AUTH_REQUIRED si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await deleteAlmacenAction('alm-1');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });
});
