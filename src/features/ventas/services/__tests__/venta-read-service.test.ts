import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  venta: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { ActionError } from '@/lib/server-actions';
import { VentaReadService } from '../venta-read-service';

describe('VentaReadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists tenant sales ordered by creation date desc', async () => {
    vi.mocked(mockPrisma.venta.findMany).mockResolvedValue([{ ventaId: 'v-1', total: 100 }] as never);

    const result = await VentaReadService.list('tenant-1');

    expect(result).toEqual([{ ventaId: 'v-1', total: 100 }]);
    expect(mockPrisma.venta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('applies read filters for sales list', async () => {
    vi.mocked(mockPrisma.venta.findMany).mockResolvedValue([{ ventaId: 'v-2', total: 200 }] as never);

    await VentaReadService.list('tenant-1', {
      puntoDeVentaId: 'pv-1',
      clienteId: 'cliente-1',
      search: 'maria',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });

    expect(mockPrisma.venta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          deletedAt: null,
          puntoDeVentaId: 'pv-1',
          clienteId: 'cliente-1',
          createdAt: {
            gte: new Date('2026-01-01T00:00:00.000Z'),
            lte: new Date('2026-01-31T23:59:59.999Z'),
          },
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('incluye precioCosto del producto en los items para calcular rentabilidad', async () => {
    vi.mocked(mockPrisma.venta.findMany).mockResolvedValue([] as never);

    await VentaReadService.list('tenant-1');

    const select = vi.mocked(mockPrisma.venta.findMany).mock.calls[0][0].select as {
      items: { select: { producto: { select: Record<string, unknown> } } };
    };
    expect(select.items.select.producto.select.precioCosto).toBe(true);
  });

  it('returns a tenant sale by id', async () => {
    vi.mocked(mockPrisma.venta.findFirst).mockResolvedValue({ ventaId: 'v-3', total: 300 } as never);

    const result = await VentaReadService.getById({ tenantId: 'tenant-1', ventaId: 'v-3' });

    expect(result).toEqual({ ventaId: 'v-3', total: 300 });
    expect(mockPrisma.venta.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ventaId: 'v-3', tenantId: 'tenant-1', deletedAt: null },
      }),
    );
  });

  it('throws NOT_FOUND when the sale does not exist', async () => {
    vi.mocked(mockPrisma.venta.findFirst).mockResolvedValue(null as never);

    await expect(
      VentaReadService.getById({ tenantId: 'tenant-1', ventaId: 'missing-sale' }),
    ).rejects.toMatchObject<ActionError>({
      code: 'NOT_FOUND',
      message: 'Venta no encontrada',
    });
  });
});
