import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const user = {
    userId: 'user-1',
    name: 'Usuario',
    email: 'user@example.com',
    role: 'admin',
    tenantId: 'tenant-a',
    tenantRole: 'manager',
    isActive: true,
    planFeatures: { variantes: true, productos: true, 'listas-precios': true },
  };
  const transaction = {
    productoPlantilla: {
      create: vi.fn().mockResolvedValue({ id: 'template-1', tenantId: 'tenant-a' }),
    },
    producto: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: `product-${String(data.sku)}`,
        nombre: data.nombre,
        sku: data.sku,
        atributoJson: data.atributoJson,
        precioCosto: data.precioCosto,
        precioVenta: data.precioVenta,
        stock: data.stock,
        almacenId: data.almacenId,
      })),
    },
    stockUbicacion: { upsert: vi.fn() },
  };
  const prisma = {
    productoPlantilla: { findMany: vi.fn() },
    producto: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    categoria: { findFirst: vi.fn().mockResolvedValue({ catId: 'category-1' }) },
    almacen: { findFirst: vi.fn().mockResolvedValue({ almacenId: 'warehouse-1' }) },
    unidad: { findFirst: vi.fn().mockResolvedValue({ unidadId: 'unit-1' }) },
    vendor: { findFirst: vi.fn().mockResolvedValue({ vendorId: 'vendor-1' }) },
    puntoDeVenta: { findFirst: vi.fn().mockResolvedValue({ pvId: 'pos-1' }) },
    listaPrecio: { count: vi.fn().mockResolvedValue(1) },
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
  };
  const userWithFeature = { current: user };
  return { prisma, transaction, userWithFeature };
});

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/server-actions', () => ({
  ActionError: class ActionError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
  withAction: (action: (input: unknown, user: unknown) => unknown) =>
    (input: unknown) => action(input, mocks.userWithFeature.current),
}));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: (user: { tenantId?: string }) => {
    if (!user.tenantId) throw new Error('tenant required');
    return user.tenantId;
  },
  requireFeature: (user: { planFeatures?: Record<string, boolean> }, key: string) => {
    if (!user.planFeatures?.[key]) throw new Error(`feature ${key} required`);
  },
  requirePermission: vi.fn(),
  validateTenantLimit: vi.fn(),
}));
vi.mock('@/lib/services/stock-ubicacion-service', () => ({
  upsertStockUbicacion: vi.fn(),
}));
vi.mock('@/lib/services/stock-ubicacion-queries', () => ({
  getStockTotalProductosBatch: vi.fn().mockResolvedValue(new Map()),
}));

import {
  createPlantillaVariantesAction,
  updateVarianteCatalogoAction,
} from '../actions-variantes';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';

const validInput = {
  nombrePlantilla: 'Camiseta',
  nombreProducto: 'Camiseta',
  skuPrefijo: 'CAM',
  atributos: [
    { nombre: 'Talla', valores: ['S', 'M'] },
    { nombre: 'Color', valores: ['Azul', 'Rojo'] },
  ],
  precioCosto: 500,
  precioVenta: 900,
  stockInicial: 3,
  stockMinimo: 1,
  categoriaId: 'category-1',
  almacenId: 'warehouse-1',
  precios: [{ listaPrecioId: 'list-1', precio: 850 }],
};

describe('acciones de variantes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userWithFeature.current = {
      ...mocks.userWithFeature.current,
      planFeatures: { variantes: true, productos: true, 'listas-precios': true },
    };
    mocks.prisma.categoria.findFirst.mockResolvedValue({ catId: 'category-1' });
    mocks.prisma.almacen.findFirst.mockResolvedValue({ almacenId: 'warehouse-1' });
    mocks.prisma.listaPrecio.count.mockResolvedValue(1);
    mocks.prisma.producto.count.mockResolvedValue(0);
    mocks.transaction.producto.create.mockImplementation(async ({ data }) => ({
      id: `product-${String(data.sku)}`,
      nombre: data.nombre,
      sku: data.sku,
      atributoJson: data.atributoJson,
      precioCosto: data.precioCosto,
      precioVenta: data.precioVenta,
      stock: data.stock,
      almacenId: data.almacenId,
    }));
  });

  it('persiste cada combinación como producto vendible con SKU y stock propios', async () => {
    const result = await createPlantillaVariantesAction(validInput);

    expect(result).toMatchObject({ id: 'template-1', tenantId: 'tenant-a' });
    expect(mocks.transaction.producto.create).toHaveBeenCalledTimes(4);
    expect(mocks.transaction.producto.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-a',
        plantillaId: 'template-1',
        esVariante: true,
        sku: 'CAM-S-AZUL',
        atributoJson: { Talla: 'S', Color: 'Azul' },
      }),
    }));
    expect(upsertStockUbicacion).toHaveBeenCalledTimes(4);
    expect(upsertStockUbicacion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ productoId: 'product-CAM-S-AZUL', valor: 3 }),
    );
  });

  it('rechaza referencias de categoría fuera del tenant antes de abrir la transacción', async () => {
    mocks.prisma.categoria.findFirst.mockResolvedValue(null);

    await expect(createPlantillaVariantesAction(validInput)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('exige feature flag antes de consultar o crear variantes', async () => {
    mocks.userWithFeature.current = {
      ...mocks.userWithFeature.current,
      planFeatures: { variantes: false, productos: true, 'listas-precios': true },
    };

    await expect(createPlantillaVariantesAction(validInput)).rejects.toThrow('feature variantes required');
    expect(mocks.prisma.categoria.findFirst).not.toHaveBeenCalled();
  });

  it('solo permite editar SKU y precios de una variante del tenant activo', async () => {
    mocks.prisma.producto.findFirst
      .mockResolvedValueOnce({ id: 'variant-1' })
      .mockResolvedValueOnce(null);
    mocks.prisma.producto.update.mockResolvedValue({
      id: 'variant-1',
      sku: 'CAM-M-AZUL',
      precioCosto: 550,
      precioVenta: 950,
      stock: 3,
    });

    const result = await updateVarianteCatalogoAction({
      productoId: 'variant-1',
      sku: 'CAM-M-AZUL',
      precioCosto: 550,
      precioVenta: 950,
    });

    expect(result).toMatchObject({ id: 'variant-1', sku: 'CAM-M-AZUL' });
    expect(mocks.prisma.producto.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: 'variant-1', tenantId: 'tenant-a', esVariante: true },
      select: { id: true },
    });
    expect(mocks.prisma.producto.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'variant-1' },
      data: { sku: 'CAM-M-AZUL', precioCosto: 550, precioVenta: 950 },
    }));
  });
});
