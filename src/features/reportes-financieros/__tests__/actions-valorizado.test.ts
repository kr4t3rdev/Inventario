import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/lib/prisma', () => ({
  prisma: {
    stockMoveLine: { groupBy: vi.fn() },
    compraDocumentoItem: { findMany: vi.fn() },
    purchaseAllocation: { groupBy: vi.fn() },
    producto: { findMany: vi.fn() },
    productoCostHistory: { findMany: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getValorizadoAFechaAction } from '@/features/reportes-financieros/actions-valorizado';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const user: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com', role: 'admin',
  isActive: true, tenantId: 'tenant-1', tenantRole: 'manager',
};

describe('getValorizadoAFechaAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.stockMoveLine.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.compraDocumentoItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.purchaseAllocation.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'p1', precioCosto: 12 },
    ] as never);
    vi.mocked(prisma.productoCostHistory.findMany).mockResolvedValue([]);
    vi.mocked(getCurrentUser).mockResolvedValue(user);
  });

  it('valora existencias sin movimientos de compra al cierre y limita las consultas al tenant', async () => {
    const result = await getValorizadoAFechaAction({ fechaCorte: new Date('2026-10-31') });

    expect(result.success).toBe(true);
    expect(prisma.stockMoveLine.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-1' }),
    }));
    expect(prisma.compraDocumentoItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-1' }),
    }));
    expect(prisma.stockMoveLine.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        createdAt: { lt: new Date('2026-11-01T00:00:00.000Z') },
      }),
    }));
    if (!result.success) throw new Error('No se generó el valorizado');
    expect(result.data.porProducto[0]).toMatchObject({
      productoId: 'p1', valorFifo: 0, tieneEstimado: false,
    });
  });

  it('rechaza una fecha de corte inválida', async () => {
    const result = await getValorizadoAFechaAction({ fechaCorte: new Date('invalid') });
    expect(result.success).toBe(false);
    expect(prisma.stockMoveLine.groupBy).not.toHaveBeenCalled();
  });

  it('usa el CPP previo a los cambios posteriores al corte', async () => {
    vi.mocked(prisma.stockMoveLine.groupBy).mockResolvedValue([
      { productoId: 'p1', _sum: { cantidad: 2 } },
    ] as never);
    vi.mocked(prisma.productoCostHistory.findMany).mockResolvedValue([
      { productoId: 'p1', oldPrecioCosto: 10 },
    ] as never);

    const result = await getValorizadoAFechaAction({ fechaCorte: new Date('2026-10-31') });

    if (!result.success) throw new Error('No se generó el valorizado');
    expect(result.data.porProducto[0]).toMatchObject({ valorFifo: 20, tieneEstimado: true });
    expect(prisma.productoCostHistory.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ changedAt: { gte: new Date('2026-11-01T00:00:00.000Z') } }),
    }));
  });
});
