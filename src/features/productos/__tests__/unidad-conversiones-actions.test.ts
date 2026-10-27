import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db/platform-prisma', () => ({ prismaPlatform: {}, default: {} }));
vi.mock('@/generated/prisma', () => ({ Prisma: {}, PrismaClient: class {} }));
const txMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  producto: { findFirst: vi.fn() },
  unidad: { findMany: vi.fn() },
  unidadConversion: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: { findFirst: vi.fn() },
    unidad: { findMany: vi.fn(), findFirst: vi.fn() },
    unidadConversion: {
      findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(txMock)),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  getProductUnitConversionsAction,
  createProductUnitConversionAction,
} from '@/features/productos/actions-unidad-conversiones';

const user = {
  userId: 'user-1', name: 'Test', email: 'test@example.com', role: 'admin', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager',
} as any;

describe('product unit conversion actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
  });

  it('lists only conversions scoped to the authenticated tenant and product', async () => {
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'product-1', tenantId: 'tenant-1', unidadId: 'unit-base',
      unidad: { unidadId: 'unit-base', tenantId: 'tenant-1', nombre: 'Unidad', simbolo: 'u', dimension: 'COUNT' },
    } as any);
    vi.mocked(prisma.unidadConversion.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.unidad.findMany).mockResolvedValue([] as any);

    const result = await getProductUnitConversionsAction('product-1');

    expect(result.success).toBe(true);
    expect(prisma.producto.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'product-1', tenantId: 'tenant-1' },
    }));
    expect(prisma.unidadConversion.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', productoId: 'product-1', baseUnidadId: 'unit-base' },
    }));
  });

  it('denies conversion writes to a tenant user without product edit permission', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...user, role: 'user', tenantRole: 'dependiente', planFeatures: { unidades: true },
    } as any);

    const result = await createProductUnitConversionAction({
      productoId: 'product-1', unidadId: 'unit-source', factorAStock: '12',
    });

    expect(result.success).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a conversion whose units have different dimensions', async () => {
    vi.mocked(txMock.producto.findFirst).mockResolvedValue({
      id: 'product-1', tenantId: 'tenant-1', unidadId: 'unit-base',
    } as any);
    vi.mocked(txMock.unidad.findMany).mockResolvedValue([
      { unidadId: 'unit-source', tenantId: 'tenant-1', dimension: 'MASS' },
      { unidadId: 'unit-base', tenantId: 'tenant-1', dimension: 'COUNT' },
    ] as any);

    const result = await createProductUnitConversionAction({
      productoId: 'product-1', unidadId: 'unit-source', factorAStock: '12.5',
    });

    expect(result.success).toBe(false);
    expect(txMock.unidadConversion.create).not.toHaveBeenCalled();
  });

  it('stores precise factor after validating a same-tenant product/base pair', async () => {
    vi.mocked(txMock.producto.findFirst).mockResolvedValue({
      id: 'product-1', tenantId: 'tenant-1', unidadId: 'unit-base',
    } as any);
    vi.mocked(txMock.unidad.findMany).mockResolvedValue([
      { unidadId: 'unit-source', tenantId: 'tenant-1', dimension: 'COUNT' },
      { unidadId: 'unit-base', tenantId: 'tenant-1', dimension: 'COUNT' },
    ] as any);
    vi.mocked(txMock.unidadConversion.create).mockResolvedValue({ id: 'conversion-1' } as any);

    const result = await createProductUnitConversionAction({
      productoId: 'product-1', unidadId: 'unit-source', factorAStock: '12.34567891',
    });

    expect(result.success).toBe(true);
    expect(txMock.unidadConversion.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      tenantId: 'tenant-1', productoId: 'product-1', baseUnidadId: 'unit-base',
      unidadId: 'unit-source', factorAStock: '12.34567891',
    }) });
  });
});
