import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  producto: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  stockUbicacion: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { ActionError } from '@/lib/server-actions';
import { ProductoService } from '../producto-service';

describe('ProductoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists tenant-scoped products ordered by creation date desc', async () => {
    vi.mocked(mockPrisma.producto.findMany).mockResolvedValue([{ id: 'prod-1', nombre: 'Harina' }] as never);

    const result = await ProductoService.list('tenant-1');

    expect(result).toEqual([{ id: 'prod-1', nombre: 'Harina' }]);
    expect(mockPrisma.producto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('returns a tenant-scoped product by id', async () => {
    vi.mocked(mockPrisma.producto.findFirst).mockResolvedValue({ id: 'prod-2', nombre: 'Azúcar' } as never);

    const result = await ProductoService.getById({ tenantId: 'tenant-1', productId: 'prod-2' });

    expect(result).toEqual({ id: 'prod-2', nombre: 'Azúcar' });
    expect(mockPrisma.producto.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prod-2', tenantId: 'tenant-1' },
      }),
    );
  });

  it('throws NOT_FOUND when the tenant-scoped product does not exist', async () => {
    vi.mocked(mockPrisma.producto.findFirst).mockResolvedValue(null as never);

    await expect(
      ProductoService.getById({ tenantId: 'tenant-1', productId: 'missing-prod' }),
    ).rejects.toMatchObject<ActionError>({
      code: 'NOT_FOUND',
      message: 'Producto no encontrado',
    });
  });

  it('lists products by location including stock filters and text search', async () => {
    vi.mocked(mockPrisma.stockUbicacion.findMany).mockResolvedValue([
      {
        cantidad: 8,
        producto: {
          id: 'prod-1',
          nombre: 'Harina Integral',
          stock: 20,
          categoria: { nombre: 'Harinas' },
          subcategoria: { nombre: 'Integrales' },
          vendor: { nombre: 'Molino Norte' },
        },
      },
    ] as never);

    const result = await ProductoService.listByLocation({
      tenantId: 'tenant-1',
      ubicacionId: 'almacen-1',
      tipoUbicacion: 'almacen',
      includeZero: false,
      search: 'integral',
      categoryId: 'cat-1',
      subcategoryId: 'sub-1',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'prod-1',
      stockUbicacion: 8,
      stockTotal: 20,
    });
    expect(mockPrisma.stockUbicacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ubicacionId: 'almacen-1',
          tipoUbicacion: 'almacen',
          tenantId: 'tenant-1',
          cantidad: { gt: 0 },
          producto: expect.objectContaining({
            categoriaId: 'cat-1',
            subcategoriaId: 'sub-1',
          }),
        }),
      }),
    );
  });
});
