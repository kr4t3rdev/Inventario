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
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ userId: 'u-1', tenantId: 'tenant-1' }] as any);
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
});
