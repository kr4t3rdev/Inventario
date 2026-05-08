/**
 * @description Tests unitarios para Server Actions de productos.
 * Sigue TDD: RED → GREEN → REFACTOR.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mockeamos dependencias ANTES de importar el módulo
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/generated/prisma', () => {
  class MockPrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, opts: { code: string; clientVersion: string }) {
      super(message);
      this.code = opts.code;
      this.name = 'PrismaClientKnownRequestError';
    }
  }
  return {
    Prisma: {
      PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
      PrismaClientValidationError: class extends Error {
        constructor(message: string, clientVersion: string) {
          super(message);
          this.name = 'PrismaClientValidationError';
        }
      },
    },
  };
});
vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: {
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
  getProductosAction,
  createProductoAction,
  updateProductoAction,
  deleteProductoAction,
} from '@/features/productos/actions';
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

const mockProducto = {
  id: 'prod-1',
  nombre: 'Producto Test',
  descripcion: 'Descripción',
  precioCosto: 100,
  precioVenta: 200,
  stock: 50,
  stockMinimo: 10,
  codigoInterno: '12345678901',
  proveedorCodigo: null,
  categoriaId: 'cat-1',
  subcategoriaId: null,
  unidadId: 'unidad-1',
  vendorId: null,
  almacenId: 'almacen-1',
  puntoDeVentaId: null,
  fotos: [],
  tenantId: 'tenant-test',
  esCompuesto: false,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

// ─── Tests ─────────────────────────────────────────────────

describe('Productos Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getProductosAction ───────────────────────

  describe('getProductosAction', () => {
    it('retorna lista de productos del tenant', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findMany).mockResolvedValue([mockProducto]);

      const result = await getProductosAction();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].nombre).toBe('Producto Test');
      expect(prisma.producto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-test' }),
        })
      );
    });

    it('retorna lista vacía si no hay productos', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findMany).mockResolvedValue([]);

      const result = await getProductosAction();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  // ─── createProductoAction ─────────────────────

  describe('createProductoAction', () => {
    const validInput = {
      nombre: 'Nuevo Producto',
      descripcion: 'Descripción',
      precioCosto: 500,
      precioVenta: 1000,
      stock: 100,
      stockMinimo: 5,
      codigoInterno: null as string | null,
      proveedorCodigo: null as string | null,
      categoriaId: 'cat-1',
      subcategoriaId: null as string | null,
      unidadId: 'unidad-1',
      vendorId: null as string | null,
      almacenId: 'almacen-1',
      puntoDeVentaId: null as string | null,
      fotos: [],
    };

    it('crea producto exitosamente con datos válidos', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.create).mockResolvedValue(mockProducto);

      const result = await createProductoAction(validInput);

      expect(result.success).toBe(true);
      expect(prisma.producto.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nombre: 'Nuevo Producto',
            tenantId: 'tenant-test',
          }),
        })
      );
    });

    it('retorna error de validación si el nombre está vacío', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const result = await createProductoAction({ ...validInput, nombre: '' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBeDefined();
    });

    it('retorna error de validación si el precio es negativo', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const result = await createProductoAction({ ...validInput, precioCosto: -10 });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBeDefined();
    });
  });

  // ─── updateProductoAction ─────────────────────

  describe('updateProductoAction', () => {
    const validUpdate = {
      id: 'prod-1',
      nombre: 'Producto Actualizado',
      precioVenta: 300,
    };

    it('actualiza producto exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findUnique).mockResolvedValue(mockProducto);
      vi.mocked(prisma.producto.update).mockResolvedValue({ ...mockProducto, nombre: 'Producto Actualizado' });

      const result = await updateProductoAction(validUpdate);

      expect(result.success).toBe(true);
      expect(prisma.producto.update).toHaveBeenCalled();
    });

    it('retorna error si el producto no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findUnique).mockResolvedValue(null);

      const result = await updateProductoAction(validUpdate);

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('no encontrado');
    });
  });

  // ─── deleteProductoAction ─────────────────────

  describe('deleteProductoAction', () => {
    it('elimina producto exitosamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findUnique).mockResolvedValue(mockProducto);
      vi.mocked(prisma.producto.delete).mockResolvedValue(mockProducto);

      const result = await deleteProductoAction('prod-1');

      expect(result.success).toBe(true);
      expect(prisma.producto.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'prod-1' } })
      );
    });

    it('retorna error si el producto no existe', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(prisma.producto.findUnique).mockResolvedValue(null);

      const result = await deleteProductoAction('prod-noexiste');

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('no encontrado');
    });
  });

  // ─── Auth requerido ───────────────────────────

  describe('auth requerido', () => {
    it('getProductosAction retorna AUTH_REQUIRED sin usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await getProductosAction();

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('AUTH_REQUIRED');
    });
  });
});
