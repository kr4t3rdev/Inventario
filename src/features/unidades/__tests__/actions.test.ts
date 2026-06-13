/**
 * @description Tests unitarios para Server Actions de unidades (v2 tenant-scoped).
 *
 * Cubre:
 * - CRUD básico (list, get, create, update, delete)
 * - Tenant scoping (cross-tenant isolation)
 * - Unicidad de nombre y símbolo scoped por tenant (CONFLICT)
 * - Validación Zod (VALIDATION_ERROR)
 * - Autenticación requerida (AUTH_REQUIRED)
 * - Self-update permitido
 * - Delete bloqueado si la unidad está en uso (IN_USE)
 * - P2002 Prisma error fallback (race condition)
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
    producto: {
      count: vi.fn(),
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

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

const mockUserA: AuthenticatedUser = {
  userId: 'user-a',
  name: 'User A',
  email: 'a@test.com',
  role: 'admin',
  isActive: true,
  tenantId: TENANT_A,
  tenantRole: 'admin',
};

const mockUnidadRow = {
  unidadId: 'uni-1',
  tenantId: TENANT_A,
  nombre: 'Kilogramo',
  simbolo: 'kg',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockUnidadRow2 = {
  unidadId: 'uni-2',
  tenantId: TENANT_A,
  nombre: 'Libra',
  simbolo: 'lb',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockUnidadTenantB = {
  unidadId: 'uni-b1',
  tenantId: TENANT_B,
  nombre: 'Tonelada',
  simbolo: 't',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

// Helper: crea un error tipo Prisma P2002
function makeP2002(targetFields: string[]) {
  const err = new Error('Unique constraint failed') as Error & Record<string, unknown>;
  err.name = 'PrismaClientKnownRequestError';
  err.code = 'P2002';
  (err as any).meta = { target: targetFields };
  return err;
}

describe('Unidades Server Actions (tenant-scoped v2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUserA);
    // Por defecto: no hay duplicados, no hay productos en uso
    vi.mocked(prisma.unidad.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.producto.count).mockResolvedValue(0);
  });

  // ══════════════════════════════════════════════════════
  // getUnidadesAction
  // ══════════════════════════════════════════════════════

  describe('getUnidadesAction', () => {
    it('retorna lista de unidades del tenant', async () => {
      vi.mocked(prisma.unidad.findMany).mockResolvedValue([mockUnidadRow]);

      const result = await getUnidadesAction();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].nombre).toBe('Kilogramo');
      // Verifica que filtró por tenantId
      expect(prisma.unidad.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_A },
        })
      );
    });

    it('retorna lista vacía si no hay unidades', async () => {
      vi.mocked(prisma.unidad.findMany).mockResolvedValue([]);

      const result = await getUnidadesAction();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('filtra por tenant — no ve unidades de otro tenant', async () => {
      // findMany mock retorna solo las del tenant A
      vi.mocked(prisma.unidad.findMany).mockResolvedValue([mockUnidadRow]);

      const result = await getUnidadesAction();
      expect(result.data).toHaveLength(1);
      expect(result.data![0].tenantId).toBe(TENANT_A);
    });

    it('serializa fechas a ISO strings', async () => {
      vi.mocked(prisma.unidad.findMany).mockResolvedValue([mockUnidadRow]);

      const result = await getUnidadesAction();

      expect(result.success).toBe(true);
      expect(typeof result.data![0].createdAt).toBe('string');
      expect(result.data![0].createdAt).toBe(mockUnidadRow.createdAt.toISOString());
    });
  });

  // ══════════════════════════════════════════════════════
  // getUnidadByIdAction
  // ══════════════════════════════════════════════════════

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

    it('retorna NOT_FOUND si la unidad pertenece a otro tenant', async () => {
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(mockUnidadTenantB);

      const result = await getUnidadByIdAction('uni-b1');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  // ══════════════════════════════════════════════════════
  // createUnidadAction
  // ══════════════════════════════════════════════════════

  describe('createUnidadAction', () => {
    it('crea unidad exitosamente con tenantId', async () => {
      vi.mocked(prisma.unidad.create).mockResolvedValue(mockUnidadRow);

      const result = await createUnidadAction({ nombre: 'Kilogramo', simbolo: 'kg' });

      expect(result.success).toBe(true);
      // Debe haber verificado unicidad con tenantId
      expect(prisma.unidad.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            nombre: 'Kilogramo',
            tenantId: TENANT_A,
          }),
        })
      );
      // Debe incluir tenantId en el create
      expect(prisma.unidad.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nombre: 'Kilogramo',
            simbolo: 'kg',
            tenantId: TENANT_A,
          }),
        })
      );
    });

    it('retorna error de validación si falta el nombre', async () => {
      const result = await createUnidadAction({ nombre: '', simbolo: 'kg' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('VALIDATION_ERROR');
    });

    it('retorna CONFLICT si el nombre ya existe en el tenant', async () => {
      vi.mocked(prisma.unidad.findFirst).mockResolvedValue(mockUnidadRow);

      const result = await createUnidadAction({ nombre: 'Kilogramo', simbolo: 'kg' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('CONFLICT');
      expect(result.error!.message).toContain('Kilogramo');
    });

    it('retorna CONFLICT si el símbolo ya existe en el tenant', async () => {
      vi.mocked(prisma.unidad.findFirst)
        .mockResolvedValueOnce(null) // nombre único
        .mockResolvedValueOnce(mockUnidadRow); // símbolo duplicado

      const result = await createUnidadAction({ nombre: 'NuevaUnidad', simbolo: 'kg' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('CONFLICT');
      expect(result.error!.message).toContain('kg');
    });

    it('permite mismo nombre en tenant diferente', async () => {
      // findFirst: el nombre no existe en TENANT_A → null → ok
      vi.mocked(prisma.unidad.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.unidad.create).mockResolvedValue(mockUnidadRow);

      const result = await createUnidadAction({ nombre: 'Kilogramo', simbolo: 'kg' });

      expect(result.success).toBe(true);
      expect(prisma.unidad.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_A }),
        })
      );
    });

    it('maneja P2002 (race condition) como CONFLICT', async () => {
      // Pre-check pasa (no duplicado)
      vi.mocked(prisma.unidad.findFirst).mockResolvedValue(null);
      // Pero Prisma lanza P2002 por race condition
      vi.mocked(prisma.unidad.create).mockRejectedValue(makeP2002(['nombre']));

      const result = await createUnidadAction({ nombre: 'Kilogramo', simbolo: 'k' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('CONFLICT');
      expect(result.error!.message).toContain('Kilogramo');
    });

    it('maneja P2002 con target simbolo como CONFLICT', async () => {
      vi.mocked(prisma.unidad.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.unidad.create).mockRejectedValue(makeP2002(['simbolo']));

      const result = await createUnidadAction({ nombre: 'Nuevo', simbolo: 'kg' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('CONFLICT');
      expect(result.error!.message).toContain('kg');
    });
  });

  // ══════════════════════════════════════════════════════
  // updateUnidadAction
  // ══════════════════════════════════════════════════════

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
      expect(typeof result.data!.createdAt).toBe('string');
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

    it('retorna NOT_FOUND si pertenece a otro tenant', async () => {
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(mockUnidadTenantB);

      const result = await updateUnidadAction({
        unidadId: 'uni-b1',
        nombre: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });

    it('retorna CONFLICT si el nombre conflictúa con otra unidad del tenant', async () => {
      vi.mocked(prisma.unidad.findFirst).mockResolvedValue(mockUnidadRow2);

      const result = await updateUnidadAction({
        unidadId: 'uni-1',
        nombre: 'Libra',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('CONFLICT');
      expect(result.error!.message).toContain('Libra');
    });

    it('permite self-update (mismo nombre, mismo id, mismo tenant)', async () => {
      vi.mocked(prisma.unidad.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.unidad.update).mockResolvedValue({ ...mockUnidadRow, nombre: 'Kilogramo' });

      const result = await updateUnidadAction({
        unidadId: 'uni-1',
        nombre: 'Kilogramo',
      });

      expect(result.success).toBe(true);
      expect(prisma.unidad.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            nombre: 'Kilogramo',
            tenantId: TENANT_A,
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

    it('maneja P2002 en update como CONFLICT', async () => {
      vi.mocked(prisma.unidad.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.unidad.update).mockRejectedValue(makeP2002(['nombre']));

      const result = await updateUnidadAction({
        unidadId: 'uni-1',
        nombre: 'X',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('CONFLICT');
    });
  });

  // ══════════════════════════════════════════════════════
  // deleteUnidadAction
  // ══════════════════════════════════════════════════════

  describe('deleteUnidadAction', () => {
    it('elimina unidad exitosamente', async () => {
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(mockUnidadRow);
      vi.mocked(prisma.producto.count).mockResolvedValue(0);
      vi.mocked(prisma.unidad.delete).mockResolvedValue(mockUnidadRow);

      const result = await deleteUnidadAction('uni-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 'uni-1', eliminado: true });
      expect(prisma.producto.count).toHaveBeenCalledWith({
        where: { unidadId: 'uni-1' },
      });
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

    it('retorna NOT_FOUND si pertenece a otro tenant', async () => {
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(mockUnidadTenantB);

      const result = await deleteUnidadAction('uni-b1');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });

    it('retorna IN_USE si hay productos que usan la unidad', async () => {
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(mockUnidadRow);
      vi.mocked(prisma.producto.count).mockResolvedValue(5);

      const result = await deleteUnidadAction('uni-1');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('IN_USE');
      expect(result.error!.message).toBe(
        'No se puede eliminar: está en uso por 5 producto(s)'
      );
    });

    it('retorna IN_USE con conteo correcto para 1 producto', async () => {
      vi.mocked(prisma.unidad.findUnique).mockResolvedValue(mockUnidadRow);
      vi.mocked(prisma.producto.count).mockResolvedValue(1);

      const result = await deleteUnidadAction('uni-1');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('IN_USE');
      expect(result.error!.message).toContain('1 producto');
    });
  });

  // ══════════════════════════════════════════════════════
  // Auth requerido
  // ══════════════════════════════════════════════════════

  describe('auth requerido', () => {
    it('getUnidadesAction retorna AUTH_REQUIRED si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await getUnidadesAction();

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });

    it('createUnidadAction retorna AUTH_REQUIRED si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await createUnidadAction({ nombre: 'X', simbolo: 'x' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });

    it('deleteUnidadAction retorna AUTH_REQUIRED si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await deleteUnidadAction('any-id');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });
});
