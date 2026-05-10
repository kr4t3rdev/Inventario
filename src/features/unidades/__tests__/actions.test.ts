/**
 * @description Tests unitarios para Server Actions de unidades.
 *
 * Cubre:
 * - CRUD básico (list, get, create, update, delete)
 * - Unicidad de nombre y símbolo (CONFLICT)
 * - Validación Zod (VALIDATION_ERROR)
 * - Autenticación requerida (AUTH_REQUIRED)
 * - Self-update permitido
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

const mockUnidadRow2 = {
  unidadId: 'uni-2',
  nombre: 'Libra',
  simbolo: 'lb',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('Unidades Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    // Por defecto, no hay duplicados
    vi.mocked(prisma.unidad.findFirst).mockResolvedValue(null);
  });

  // ─── getUnidadesAction ─────────────────────────────────

  describe('getUnidadesAction', () => {
    it('retorna lista de unidades', async () => {
      vi.mocked(prisma.unidad.findMany).mockResolvedValue([mockUnidadRow]);

      const result = await getUnidadesAction();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].nombre).toBe('Kilogramo');
    });

    it('retorna lista vacía si no hay unidades', async () => {
      vi.mocked(prisma.unidad.findMany).mockResolvedValue([]);

      const result = await getUnidadesAction();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  // ─── getUnidadByIdAction ───────────────────────────────

  describe('getUnidadByIdAction', () => {
    it('retorna unidad por ID', async () => {
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(mockUnidadRow);

      const result = await getUnidadByIdAction('uni-1');

      expect(result.success).toBe(true);
      expect(result.data!.nombre).toBe('Kilogramo');
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(null);

      const result = await getUnidadByIdAction('uni-noexiste');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  // ─── createUnidadAction ────────────────────────────────

  describe('createUnidadAction', () => {
    it('crea unidad exitosamente', async () => {
      vi.mocked(prisma.unidad.create).mockResolvedValue(mockUnidadRow);

      const result = await createUnidadAction({ nombre: 'Kilogramo', simbolo: 'kg' });

      expect(result.success).toBe(true);
      // Debe haber verificado unicidad (findFirst llamado con nombre y simbolo)
      expect(prisma.unidad.findFirst).toHaveBeenCalled();
      expect(prisma.unidad.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ nombre: 'Kilogramo', simbolo: 'kg' }),
        })
      );
    });

    it('retorna error de validación si falta el nombre', async () => {
      const result = await createUnidadAction({ nombre: '', simbolo: 'kg' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('VALIDATION_ERROR');
    });

    it('retorna CONFLICT si el nombre ya existe', async () => {
      // Simular que ya existe una unidad con ese nombre
      vi.mocked(prisma.unidad.findFirst).mockResolvedValue(mockUnidadRow);

      const result = await createUnidadAction({ nombre: 'Kilogramo', simbolo: 'kg' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('CONFLICT');
      expect(result.error!.message).toContain('Kilogramo');
    });

    it('retorna CONFLICT si el símbolo ya existe', async () => {
      // Primera llamada (nombre) → no hay duplicado, segunda (símbolo) → encuentra duplicado
      vi.mocked(prisma.unidad.findFirst)
        .mockResolvedValueOnce(null) // nombre: 'NuevaUnidad' es único
        .mockResolvedValueOnce(mockUnidadRow); // simbolo: 'kg' ya existe

      const result = await createUnidadAction({ nombre: 'NuevaUnidad', simbolo: 'kg' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('CONFLICT');
      expect(result.error!.message).toContain('kg');
    });
  });

  // ─── updateUnidadAction ────────────────────────────────

  describe('updateUnidadAction', () => {
    beforeEach(() => {
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(mockUnidadRow);
    });

    it('actualiza unidad exitosamente', async () => {
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
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(null);

      const result = await updateUnidadAction({
        unidadId: 'uni-noexiste',
        nombre: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });

    it('retorna CONFLICT si el nombre conflictúa con otra unidad', async () => {
      // findFirst es llamado para verificar unicidad → encuentra un duplicado
      vi.mocked(prisma.unidad.findFirst).mockResolvedValue(mockUnidadRow2);

      const result = await updateUnidadAction({
        unidadId: 'uni-1',
        nombre: 'Libra', // intenta cambiar a nombre que ya existe
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('CONFLICT');
      expect(result.error!.message).toContain('Libra');
    });

    it('permite self-update (mismo nombre, mismo id)', async () => {
      // findFirst debería excluir uni-1 de la búsqueda, entonces retorna null
      vi.mocked(prisma.unidad.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.unidad.update).mockResolvedValue({
        ...mockUnidadRow,
        nombre: 'Kilogramo',
      });

      const result = await updateUnidadAction({
        unidadId: 'uni-1',
        nombre: 'Kilogramo',
      });

      expect(result.success).toBe(true);
      // Verificar que findFirst fue llamado con NOT excluyendo uni-1
      expect(prisma.unidad.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            nombre: 'Kilogramo',
            NOT: { unidadId: 'uni-1' },
          }),
        })
      );
    });

    it('retorna CONFLICT si el símbolo conflictúa con otra unidad', async () => {
      vi.mocked(prisma.unidad.findFirst).mockResolvedValue(mockUnidadRow2);

      const result = await updateUnidadAction({
        unidadId: 'uni-1',
        simbolo: 'lb',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('CONFLICT');
      expect(result.error!.message).toContain('lb');
    });
  });

  // ─── deleteUnidadAction ────────────────────────────────

  describe('deleteUnidadAction', () => {
    it('elimina unidad exitosamente', async () => {
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(mockUnidadRow);
      vi.mocked(prisma.unidad.delete).mockResolvedValue(mockUnidadRow);

      const result = await deleteUnidadAction('uni-1');

      expect(result.success).toBe(true);
      expect(prisma.unidad.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { unidadId: 'uni-1' } })
      );
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(null);

      const result = await deleteUnidadAction('uni-noexiste');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  // ─── Auth requerido ────────────────────────────────────

  describe('auth requerido', () => {
    it('getUnidadesAction retorna AUTH_REQUIRED si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await getUnidadesAction();

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });
});
