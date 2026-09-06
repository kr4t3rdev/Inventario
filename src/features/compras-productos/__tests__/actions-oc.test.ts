import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/stock-ubicacion-service', () => ({
  upsertStockUbicacion: vi.fn(),
}));

const mockTx = {
  ordenCompra: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  ordenCompraItem: { update: vi.fn() },
  recepcion: { create: vi.fn() },
  recepcionItem: { createMany: vi.fn() },
  producto: { findFirst: vi.fn() },
  stockMoveLine: { upsert: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    vendor: { findFirst: vi.fn() },
    producto: { findFirst: vi.fn() },
    ordenCompra: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    ordenCompraItem: { update: vi.fn() },
    recepcion: { create: vi.fn() },
    recepcionItem: { createMany: vi.fn() },
    reglaReabastecimiento: { findMany: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
    stockUbicacion: { findMany: vi.fn() },
    receta: { findFirst: vi.fn() },
    $transaction: vi.fn((callback: (tx: typeof mockTx) => unknown) => callback(mockTx)),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import {
  cancelarOrdenCompraAction,
  confirmarOrdenCompraAction,
  createOrdenCompraAction,
  registrarRecepcionAction,
} from '@/features/compras-productos/actions-oc';
import { sugerirReabastecimientoAction } from '@/features/compras-productos/actions-reabastecimiento';

const user = {
  userId: 'user-1',
  role: 'admin',
  tenantId: 'tenant-1',
  tenantRole: 'admin',
  isActive: true,
} as any;

describe('Órdenes de compra y recepciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
  });

  it('crea una OC en BORRADOR con total calculado', async () => {
    vi.mocked(prisma.vendor.findFirst).mockResolvedValue({ vendorId: 'ven-1' } as any);
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any);
    mockTx.ordenCompra.create.mockResolvedValue({
      id: 'oc-1', estado: 'BORRADOR', total: 1250,
    });

    const result = await createOrdenCompraAction({
      proveedorId: 'ven-1',
      items: [{ productoId: 'prod-1', cantidadPedida: 5, precioUnitario: 250 }],
    });

    expect(result.success).toBe(true);
    expect(prisma.ordenCompra.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 'tenant-1', total: 1250, estado: 'BORRADOR' }),
    }));
  });

  it('confirma una OC y rechaza confirmarla sin líneas', async () => {
    vi.mocked(prisma.ordenCompra.findFirst)
      .mockResolvedValueOnce({ id: 'oc-1', estado: 'BORRADOR', items: [{ id: 'item-1' }] } as any)
      .mockResolvedValueOnce({ id: 'oc-2', estado: 'BORRADOR', items: [] } as any);
    vi.mocked(prisma.ordenCompra.update).mockResolvedValue({ estado: 'CONFIRMADA' } as any);

    const confirmed = await confirmarOrdenCompraAction('oc-1');
    const rejected = await confirmarOrdenCompraAction('oc-2');

    expect(confirmed.success).toBe(true);
    expect(prisma.ordenCompra.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { estado: 'CONFIRMADA' },
    }));
    expect(rejected.success).toBe(false);
  });

  it('recibe parcialmente 60 de 100 y deja la OC en PARCIAL', async () => {
    mockTx.ordenCompra.findFirst.mockResolvedValue({
      id: 'oc-1', tenantId: 'tenant-1', estado: 'CONFIRMADA',
      items: [{ id: 'item-1', productoId: 'prod-1', cantidadPedida: 100, cantidadRecibida: 0, precioUnitario: 10, producto: { almacenId: 'alm-1' } }],
    });
    mockTx.recepcion.create.mockResolvedValue({ id: 'rec-1' });
    mockTx.ordenCompraItem.update.mockResolvedValue({});
    mockTx.ordenCompra.update.mockResolvedValue({ estado: 'PARCIAL' });

    const result = await registrarRecepcionAction({
      ordenId: 'oc-1',
      items: [{ ordenItemId: 'item-1', cantidad: 60 }],
    });

    expect(result.success).toBe(true);
    expect(mockTx.ordenCompra.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { estado: 'PARCIAL' },
    }));
    expect(upsertStockUbicacion).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ delta: 60 }));
    expect(mockTx.stockMoveLine.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ tipoOrigen: 'COMPRA', cantidad: 60 }),
    }));
  });

  it('recibe el saldo restante y cierra la OC en RECIBIDA', async () => {
    mockTx.ordenCompra.findFirst.mockResolvedValue({
      id: 'oc-1', tenantId: 'tenant-1', estado: 'PARCIAL',
      items: [{ id: 'item-1', productoId: 'prod-1', cantidadPedida: 100, cantidadRecibida: 60, precioUnitario: 10, producto: { almacenId: 'alm-1' } }],
    });
    mockTx.recepcion.create.mockResolvedValue({ id: 'rec-2' });
    mockTx.ordenCompraItem.update.mockResolvedValue({});
    mockTx.ordenCompra.update.mockResolvedValue({ estado: 'RECIBIDA' });

    const result = await registrarRecepcionAction({
      ordenId: 'oc-1',
      items: [{ ordenItemId: 'item-1', cantidad: 40 }],
    });

    expect(result.success).toBe(true);
    expect(mockTx.ordenCompra.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { estado: 'RECIBIDA' },
    }));
  });

  it('rechaza una recepción superior al pendiente', async () => {
    mockTx.ordenCompra.findFirst.mockResolvedValue({
      id: 'oc-1', tenantId: 'tenant-1', estado: 'CONFIRMADA',
      items: [{ id: 'item-1', productoId: 'prod-1', cantidadPedida: 100, cantidadRecibida: 90, precioUnitario: 10, producto: { almacenId: 'alm-1' } }],
    });

    const result = await registrarRecepcionAction({
      ordenId: 'oc-1',
      items: [{ ordenItemId: 'item-1', cantidad: 11 }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('RECEPCION_EXCEDENTE');
    expect(mockTx.recepcion.create).not.toHaveBeenCalled();
  });

  it('cancela una OC sin recepción total y no cancela una ya recibida', async () => {
    vi.mocked(prisma.ordenCompra.findFirst)
      .mockResolvedValueOnce({ id: 'oc-1', estado: 'PARCIAL', items: [] } as any)
      .mockResolvedValueOnce({ id: 'oc-2', estado: 'RECIBIDA', items: [] } as any);
    vi.mocked(prisma.ordenCompra.update).mockResolvedValue({ estado: 'CANCELADA' } as any);

    expect((await cancelarOrdenCompraAction('oc-1')).success).toBe(true);
    expect((await cancelarOrdenCompraAction('oc-2')).success).toBe(false);
  });

  it('sugiere comprar hasta max y fabricar cuando el producto tiene receta', async () => {
    vi.mocked(prisma.reglaReabastecimiento.findMany).mockResolvedValue([
      { id: 'r-1', productoId: 'prod-1', tipoUbicacion: 'almacen', ubicacionId: 'alm-1', min: 10, max: 25 },
      { id: 'r-2', productoId: 'prod-2', tipoUbicacion: 'almacen', ubicacionId: 'alm-1', min: 5, max: 15 },
    ] as any);
    vi.mocked(prisma.stockUbicacion.findMany).mockResolvedValue([
      { productoId: 'prod-1', tipoUbicacion: 'almacen', ubicacionId: 'alm-1', cantidadDisponible: 3 },
      { productoId: 'prod-2', tipoUbicacion: 'almacen', ubicacionId: 'alm-1', cantidadDisponible: 2 },
    ] as any);
    vi.mocked(prisma.producto.findFirst)
      .mockResolvedValueOnce({ id: 'prod-1', nombre: 'A', Receta: [{ recetaId: 'rec-1' }] } as any)
      .mockResolvedValueOnce({ id: 'prod-2', nombre: 'B', Receta: [] } as any);

    const result = await sugerirReabastecimientoAction({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ productoId: 'prod-1', cantidadSugerida: 22, tipo: 'FABRICAR' }),
      expect.objectContaining({ productoId: 'prod-2', cantidadSugerida: 13, tipo: 'COMPRAR' }),
    ]));
  });
});
