/**
 * @description Tests unitarios para Server Actions de unidades.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    unidad: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  getUnidadesAction,
  getUnidadByIdAction,
  createUnidadAction,
  updateUnidadAction,
  deleteUnidadAction,
} from '@/features/unidades/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-test-1',
  name: 'Test',
  email: 'test@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-test',
  tenantRole: 'admin',
};

const mockUnidadRow = {
  unidadId: 'uni-1',
  nombre: 'Kilogramo',
  simbolo: 'kg',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('Unidades Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUnidadesAction', () => {
    it('retorna lista de unidades', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.unidad.findMany).mockResolvedValue([mockUnidadRow]);

      const result = await getUnidadesAction();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].nombre).toBe('Kilogramo');
    });

    it('retorna lista vacía si no hay unidades', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.unidad.findMany).mockResolvedValue([]);

      const result = await getUnidadesAction();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('getUnidadByIdAction', () => {
    it('retorna unidad por ID', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(mockUnidadRow);

      const result = await getUnidadByIdAction('uni-1');

      expect(result.success).toBe(true);
      expect(result.data!.nombre).toBe('Kilogramo');
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(null);

      const result = await getUnidadByIdAction('uni-noexiste');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  describe('createUnidadAction', () => {
    it('crea unidad exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.unidad.create).mockResolvedValue(mockUnidadRow);

      const result = await createUnidadAction({ nombre: 'Kilogramo', simbolo: 'kg' });

      expect(result.success).toBe(true);
      expect(prisma.unidad.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ nombre: 'Kilogramo', simbolo: 'kg' }),
        })
      );
    });

    it('retorna error de validación si falta el nombre', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const result = await createUnidadAction({ nombre: '', simbolo: 'kg' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('updateUnidadAction', () => {
    it('actualiza unidad exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(mockUnidadRow);
      vi.mocked(prisma.unidad.update).mockResolvedValue({
        ...mockUnidadRow,
        nombre: 'Kilogramo Actualizado',
      });

      const result = await updateUnidadAction({
        unidadId: 'uni-1',
        nombre: 'Kilogramo Actualizado',
      });

      expect(result.success).toBe(true);
      expect(prisma.unidad.update).toHaveBeenCalled();
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(null);

      const result = await updateUnidadAction({
        unidadId: 'uni-noexiste',
        nombre: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('no encontrada');
    });
  });

  describe('deleteUnidadAction', () => {
    it('elimina unidad exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(mockUnidadRow);
      vi.mocked(prisma.unidad.delete).mockResolvedValue(mockUnidadRow);

      const result = await deleteUnidadAction('uni-1');

      expect(result.success).toBe(true);
      expect(prisma.unidad.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { unidadId: 'uni-1' } })
      );
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(null);

      const result = await deleteUnidadAction('uni-noexiste');

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('no encontrada');
    });
  });

  // ─── Auth requerido ─────────────────────────────────────

  describe('auth requerido', () => {
    it('getUnidadesAction retorna AUTH_REQUIRED si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await getUnidadesAction();

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });
});
