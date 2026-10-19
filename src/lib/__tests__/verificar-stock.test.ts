import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: {
      findMany: vi.fn(),
    },
    stockUbicacion: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    tenantMembership: {
      findMany: vi.fn(),
    },
    notification: {
      findFirst: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { verificarStockBajo } from '@/lib/verificar-stock';

describe('verificar-stock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simula la validación real de Prisma: el modelo User no tiene escalar
    // tenantId (la pertenencia vive en TenantMembership). El código que lo
    // pida falla en runtime, como en producción.
    vi.mocked(prisma.user.findMany).mockImplementation((args: any) => {
      if (args?.select?.tenantId || args?.where?.tenantId) {
        return Promise.reject(
          new Error('Unknown argument `tenantId`: el modelo User no tiene ese campo'),
        );
      }
      return Promise.resolve([]);
    });
  });

  it('calcula stock bajo y sin stock desde StockUbicacion en dry-run', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      {
        id: 'prod-1',
        nombre: 'Harina',
        stock: 999,
        stockMinimo: 10,
        tenantId: 'tenant-1',
        almacen: { nombre: 'Central' },
      },
      {
        id: 'prod-2',
        nombre: 'Azúcar',
        stock: 999,
        stockMinimo: 5,
        tenantId: 'tenant-1',
        almacen: { nombre: 'Central' },
      },
    ] as any);
    vi.mocked(prisma.stockUbicacion.findMany).mockResolvedValue([
      { productoId: 'prod-1', cantidad: 3 },
    ] as any);

    const result = await verificarStockBajo({ tenantId: 'tenant-1', dryRun: true });

    expect(result.productosStockBajo).toBe(1);
    expect(result.productosSinStock).toBe(1);
    expect(result.notificacionesCreadas).toBe(0);
    expect(prisma.stockUbicacion.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      select: { productoId: true, cantidad: true },
    });
  });

  it('usa el stock derivado en el mensaje de notificación', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      {
        id: 'prod-1',
        nombre: 'Harina',
        stock: 999,
        stockMinimo: 10,
        tenantId: 'tenant-1',
        almacen: { nombre: 'Central' },
      },
    ] as any);
    vi.mocked(prisma.stockUbicacion.findMany).mockResolvedValue([
      { productoId: 'prod-1', cantidad: 4 },
    ] as any);
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([{ userId: 'u-1' }] as any);
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 } as any);

    const result = await verificarStockBajo({ tenantId: 'tenant-1' });

    expect(result.productosStockBajo).toBe(1);
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          message: 'El producto "Harina" tiene stock bajo (4 de 10 mínimo) - Almacén: Central',
        }),
      ],
    });
  });

  it('notifica a los miembros activos del tenant del producto (TenantMembership, no User.tenantId)', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', nombre: 'Harina', stock: 999, stockMinimo: 10, tenantId: 'tenant-1', almacen: { nombre: 'Central' } },
    ] as any);
    vi.mocked(prisma.stockUbicacion.findMany).mockResolvedValue([
      { productoId: 'prod-1', cantidad: 4 },
    ] as any);
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([
      { userId: 'u-1' }, { userId: 'u-2' },
    ] as any);
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 2 } as any);

    const result = await verificarStockBajo({ tenantId: 'tenant-1' });

    expect(result.errores).toEqual([]);
    expect(result.notificacionesCreadas).toBe(2);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', isActive: true, user: { isActive: true } },
      select: { userId: true },
    });
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId: 'u-1' }),
        expect.objectContaining({ userId: 'u-2' }),
      ],
    });
  });

  it('sin tenantId: cada producto notifica solo a los miembros de SU tenant', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', nombre: 'Harina', stock: 999, stockMinimo: 10, tenantId: 'tenant-1', almacen: { nombre: 'A1' } },
      { id: 'prod-2', nombre: 'Aceite', stock: 999, stockMinimo: 8, tenantId: 'tenant-2', almacen: { nombre: 'A2' } },
    ] as any);
    vi.mocked(prisma.stockUbicacion.findMany).mockResolvedValue([
      { productoId: 'prod-1', cantidad: 3 },
      { productoId: 'prod-2', cantidad: 2 },
    ] as any);
    vi.mocked(prisma.tenantMembership.findMany).mockImplementation((args: any) =>
      Promise.resolve((args.where.tenantId === 'tenant-1' ? [{ userId: 'u-1' }] : [{ userId: 'u-9' }]) as any),
    );
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 } as any);

    const result = await verificarStockBajo({});

    expect(result.errores).toEqual([]);
    expect(result.notificacionesCreadas).toBe(2);
    expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) }),
    );
    expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-2' }) }),
    );
    // El producto de tenant-2 nunca notifica al usuario del tenant-1.
    const llamadas = vi.mocked(prisma.notification.createMany).mock.calls;
    expect(llamadas.some((c: any[]) => c[0].data.some((n: any) => n.userId === 'u-1' && (c[0].data[0].message as string).includes('Aceite')))).toBe(false);
  });
});
