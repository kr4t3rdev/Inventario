/**
 * @description Tests unitarios para Server Actions de puntos de venta.
 *
 * Cubre:
 * - CRUD básico (list, get, create, update, delete)
 * - Validación Zod (VALIDATION_ERROR)
 * - Auth requerido (AUTH_REQUIRED)
 * - Tenant isolation (NOT_FOUND para recursos de otro tenant)
 * - Relación listaPrecio: connect/disconnect semantics
 *
 * @module features/puntos-venta/__tests__/actions.test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    puntoDeVenta: {
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
  getPuntosDeVentaAction,
  getPuntoDeVentaByIdAction,
  createPuntoDeVentaAction,
  updatePuntoDeVentaAction,
  deletePuntoDeVentaAction,
} from '@/features/puntos-venta/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── Helpers ───────────────────────────────────────────────

const mockUser: AuthenticatedUser = {
  userId: 'user-pv-1',
  name: 'Test',
  email: 'test@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-pv',
  tenantRole: 'admin',
};

const featureBlockedUser: AuthenticatedUser = {
  userId: 'user-pv-2',
  name: 'Blocked',
  email: 'blocked@test.com',
  role: 'regularUser',
  isActive: true,
  tenantId: 'tenant-pv',
  tenantRole: 'manager',
  planFeatures: { 'puntos-venta': false },
};

const mockPvRow = {
  pvId: 'pv-1',
  nombre: 'Tienda Principal',
  ubicacion: 'Calle 123',
  tenantId: 'tenant-pv',
  listaPrecioId: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockPvWithList = {
  ...mockPvRow,
  listaPrecioId: 'lp-1',
};

const mockPvRowFull = {
  pvId: 'pv-1',
  nombre: 'Tienda Principal',
  ubicacion: 'Calle 123',
  tenantId: 'tenant-pv',
  listaPrecioId: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  listaPrecio: null,
};

// ─── Tests ─────────────────────────────────────────────────

describe('Puntos de Venta Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
  });

  // ─── getPuntosDeVentaAction ────────────────────────────

  describe('getPuntosDeVentaAction', () => {
    it('retorna lista de puntos de venta del tenant', async () => {
      vi.mocked(prisma.puntoDeVenta.findMany).mockResolvedValue([mockPvRowFull]);

      const result = await getPuntosDeVentaAction();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].nombre).toBe('Tienda Principal');
      expect(prisma.puntoDeVenta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-pv' }),
        })
      );
    });

    it('retorna lista vacía si no hay puntos de venta', async () => {
      vi.mocked(prisma.puntoDeVenta.findMany).mockResolvedValue([]);

      const result = await getPuntosDeVentaAction();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('bloquea acceso si el plan no incluye puntos de venta', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(featureBlockedUser);

      const result = await getPuntosDeVentaAction();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FEATURE_NOT_AVAILABLE');
      expect(prisma.puntoDeVenta.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── getPuntoDeVentaByIdAction ─────────────────────────

  describe('getPuntoDeVentaByIdAction', () => {
    it('retorna punto de venta por ID', async () => {
      vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue(mockPvRowFull);

      const result = await getPuntoDeVentaByIdAction('pv-1');

      expect(result.success).toBe(true);
      expect(result.data!.nombre).toBe('Tienda Principal');
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue(null);

      const result = await getPuntoDeVentaByIdAction('pv-noexiste');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });

    it('retorna NOT_FOUND para punto de venta de otro tenant', async () => {
      vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue(null);

      const result = await getPuntoDeVentaByIdAction('pv-otro-tenant');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  // ─── createPuntoDeVentaAction ──────────────────────────

  describe('createPuntoDeVentaAction', () => {
    it('crea punto de venta exitosamente sin lista de precios', async () => {
      vi.mocked(prisma.puntoDeVenta.create).mockResolvedValue(mockPvRow);

      const result = await createPuntoDeVentaAction({ nombre: 'Tienda Principal', ubicacion: 'Calle 123' });

      expect(result.success).toBe(true);
      expect(prisma.puntoDeVenta.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nombre: 'Tienda Principal',
            ubicacion: 'Calle 123',
            tenantId: 'tenant-pv',
          }),
        })
      );
    });

    it('crea punto de venta con listaPrecioId conectando la relación', async () => {
      vi.mocked(prisma.puntoDeVenta.create).mockResolvedValue(mockPvRow);

      const result = await createPuntoDeVentaAction({
        nombre: 'Tienda Principal',
        ubicacion: 'Calle 123',
        listaPrecioId: 'lp-1',
      });

      expect(result.success).toBe(true);
      // Debe pasar listaPrecioId directo a Prisma
      const createCall = vi.mocked(prisma.puntoDeVenta.create).mock.calls[0][0];
      expect(createCall.data).toHaveProperty('listaPrecioId');
      expect(createCall.data.listaPrecioId).toBe('lp-1');
    });

    it('crea punto de venta sin listaPrecioId (sin relación)', async () => {
      vi.mocked(prisma.puntoDeVenta.create).mockResolvedValue(mockPvRow);

      const result = await createPuntoDeVentaAction({
        nombre: 'Sucursal',
        ubicacion: null,
      });

      expect(result.success).toBe(true);
      const createCall = vi.mocked(prisma.puntoDeVenta.create).mock.calls[0][0];
      // listaPrecioId debe ser null (no undefined)
      expect(createCall.data.listaPrecioId).toBeNull();
    });

    it('crea punto de venta con ubicación opcional null', async () => {
      vi.mocked(prisma.puntoDeVenta.create).mockResolvedValue({ ...mockPvRow, ubicacion: null });

      const result = await createPuntoDeVentaAction({ nombre: 'Sucursal' });

      expect(result.success).toBe(true);
      expect(prisma.puntoDeVenta.create).toHaveBeenCalled();
    });

    it('retorna VALIDATION_ERROR si el nombre está vacío', async () => {
      const result = await createPuntoDeVentaAction({ nombre: '' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── updatePuntoDeVentaAction ──────────────────────────

  describe('updatePuntoDeVentaAction', () => {
    beforeEach(() => {
      vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue(mockPvRow);
    });

    it('actualiza punto de venta exitosamente', async () => {
      vi.mocked(prisma.puntoDeVenta.update).mockResolvedValue({
        ...mockPvRow,
        nombre: 'Actualizado',
      });

      const result = await updatePuntoDeVentaAction({
        pvId: 'pv-1',
        nombre: 'Actualizado',
        ubicacion: 'Nueva dirección',
      });

      expect(result.success).toBe(true);
      expect(prisma.puntoDeVenta.update).toHaveBeenCalled();
    });

    it('conecta nueva lista de precios en update', async () => {
      vi.mocked(prisma.puntoDeVenta.update).mockResolvedValue(mockPvWithList);

      const result = await updatePuntoDeVentaAction({
        pvId: 'pv-1',
        listaPrecioId: 'lp-2',
      });

      expect(result.success).toBe(true);
      const updateCall = vi.mocked(prisma.puntoDeVenta.update).mock.calls[0][0];
      expect(updateCall.data).toHaveProperty('listaPrecioId');
      expect(updateCall.data.listaPrecioId).toBe('lp-2');
    });

    it('desconecta lista de precios cuando listaPrecioId es null', async () => {
      vi.mocked(prisma.puntoDeVenta.update).mockResolvedValue(mockPvRow);

      const result = await updatePuntoDeVentaAction({
        pvId: 'pv-1',
        listaPrecioId: null,
      });

      expect(result.success).toBe(true);
      const updateCall = vi.mocked(prisma.puntoDeVenta.update).mock.calls[0][0];
      expect(updateCall.data).toHaveProperty('listaPrecioId');
      expect(updateCall.data.listaPrecioId).toBeNull();
    });

    it('no modifica listaPrecio si no se envía', async () => {
      vi.mocked(prisma.puntoDeVenta.update).mockResolvedValue(mockPvRow);

      const result = await updatePuntoDeVentaAction({
        pvId: 'pv-1',
        nombre: 'Solo nombre',
      });

      expect(result.success).toBe(true);
      const updateCall = vi.mocked(prisma.puntoDeVenta.update).mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('listaPrecioId');
    });

    it('retorna NOT_FOUND si el punto de venta no existe', async () => {
      vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue(null);

      const result = await updatePuntoDeVentaAction({
        pvId: 'pv-noexiste',
        nombre: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });

    it('retorna NOT_FOUND para punto de venta de otro tenant', async () => {
      vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue(null);

      const result = await updatePuntoDeVentaAction({
        pvId: 'pv-otro-tenant',
        nombre: 'Hack',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  // ─── deletePuntoDeVentaAction ──────────────────────────

  describe('deletePuntoDeVentaAction', () => {
    it('elimina punto de venta exitosamente', async () => {
      vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue(mockPvRow);
      vi.mocked(prisma.puntoDeVenta.delete).mockResolvedValue(mockPvRow);

      const result = await deletePuntoDeVentaAction('pv-1');

      expect(result.success).toBe(true);
      expect(prisma.puntoDeVenta.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { pvId: 'pv-1' } })
      );
    });

    it('retorna NOT_FOUND si no existe', async () => {
      vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue(null);

      const result = await deletePuntoDeVentaAction('pv-noexiste');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });

    it('retorna NOT_FOUND para punto de venta de otro tenant', async () => {
      vi.mocked(prisma.puntoDeVenta.findFirst).mockResolvedValue(null);

      const result = await deletePuntoDeVentaAction('pv-otro-tenant');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_FOUND');
    });
  });

  // ─── Auth requerido ────────────────────────────────────

  describe('auth requerido', () => {
    it('getPuntosDeVentaAction retorna AUTH_REQUIRED si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await getPuntosDeVentaAction();

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });

    it('createPuntoDeVentaAction retorna AUTH_REQUIRED si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await createPuntoDeVentaAction({ nombre: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });

    it('updatePuntoDeVentaAction retorna AUTH_REQUIRED si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await updatePuntoDeVentaAction({ pvId: 'pv-1', nombre: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });

    it('deletePuntoDeVentaAction retorna AUTH_REQUIRED si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await deletePuntoDeVentaAction('pv-1');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });

    it('getPuntoDeVentaByIdAction retorna AUTH_REQUIRED si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await getPuntoDeVentaByIdAction('pv-1');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });
});
