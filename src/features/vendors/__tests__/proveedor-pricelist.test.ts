/**
 * @description Tests F-3: pricelist de proveedor (ProveedorProducto) y 360.
 *
 * Contrato del spec proveedor-360-pricelist:
 * - Sync automático desde compras (upsert costo real + referencia a compra).
 * - CRUD manual con preferente único por producto entre vendors.
 * - Autocompletado de precio en OC desde el preferente (o el más reciente).
 * - getProveedor360Action compone perfil, pricelist, compras, CxP, anticipos,
 *   deudas cash, contratos y métricas, todo tenant-scoped.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockTx = {
  proveedorProducto: {
    upsert: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    proveedorProducto: {
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    vendor: { findFirst: vi.fn() },
    producto: { findFirst: vi.fn() },
    compraDocumento: { findMany: vi.fn(), groupBy: vi.fn() },
    cuentaPorPagar: { findMany: vi.fn() },
    anticipo: { findMany: vi.fn() },
    deudaCash: { findMany: vi.fn() },
    contrato: { findMany: vi.fn() },
    $transaction: vi.fn((cb: any) => cb(mockTx)),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  getProveedor360Action,
  resolverPrecioProveedor,
  setProveedorProductoPreferenteAction,
  sincronizarProveedorProductos,
  upsertProveedorProductoAction,
} from '../pricelist';

const user = {
  userId: 'user-1',
  role: 'admin',
  tenantId: 'tenant-1',
  tenantRole: 'admin',
  isActive: true,
} as any;

describe('F-3: sincronizarProveedorProductos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.proveedorProducto.upsert.mockResolvedValue({} as any);
  });

  it('hace upsert del costo real de cada ítem con referencia a la compra', async () => {
    await sincronizarProveedorProductos(mockTx as any, {
      tenantId: 'tenant-1',
      proveedorId: 'ven-1',
      compraDocumentoId: 'cd-1',
      moneda: 'USD',
      items: [
        { productoId: 'prod-1', precioUnitario: 500 },
        { productoId: 'prod-2', precioUnitario: 800 },
      ],
    });

    expect(mockTx.proveedorProducto.upsert).toHaveBeenCalledTimes(2);
    expect(mockTx.proveedorProducto.upsert).toHaveBeenCalledWith({
      where: {
        tenantId_vendorId_productoId: {
          tenantId: 'tenant-1',
          vendorId: 'ven-1',
          productoId: 'prod-1',
        },
      },
      create: expect.objectContaining({
        costoUnitario: 500,
        moneda: 'USD',
        ultimaCompraDocumentoId: 'cd-1',
      }),
      update: expect.objectContaining({
        costoUnitario: 500,
        moneda: 'USD',
        ultimaCompraDocumentoId: 'cd-1',
      }),
    });
  });

  it('al comprar de nuevo en otra moneda persiste la moneda nueva', async () => {
    await sincronizarProveedorProductos(mockTx as any, {
      tenantId: 'tenant-1',
      proveedorId: 'ven-1',
      compraDocumentoId: 'cd-1',
      moneda: 'USD',
      items: [{ productoId: 'prod-1', precioUnitario: 500 }],
    });
    await sincronizarProveedorProductos(mockTx as any, {
      tenantId: 'tenant-1',
      proveedorId: 'ven-1',
      compraDocumentoId: 'cd-2',
      moneda: 'CUP',
      items: [{ productoId: 'prod-1', precioUnitario: 700 }],
    });

    expect(mockTx.proveedorProducto.upsert).toHaveBeenCalledTimes(2);
    expect(mockTx.proveedorProducto.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({ costoUnitario: 700, moneda: 'CUP' }),
        update: expect.objectContaining({ costoUnitario: 700, moneda: 'CUP' }),
      }),
    );
  });
});

describe('F-3: resolverPrecioProveedor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve el precio del preferente', async () => {
    mockTx.proveedorProducto.findFirst.mockResolvedValue({
      costoUnitario: 500,
      esPreferente: true,
    } as any);

    const precio = await resolverPrecioProveedor(mockTx as any, {
      tenantId: 'tenant-1',
      proveedorId: 'ven-1',
      productoId: 'prod-1',
    });

    expect(precio).toBe(500);
  });

  it('devuelve null si el proveedor no registra precio para el producto', async () => {
    mockTx.proveedorProducto.findFirst.mockResolvedValue(null as any);

    const precio = await resolverPrecioProveedor(mockTx as any, {
      tenantId: 'tenant-1',
      proveedorId: 'ven-1',
      productoId: 'prod-1',
    });

    expect(precio).toBeNull();
  });
});

describe('F-3: upsertProveedorProductoAction y preferente único', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    vi.mocked(prisma.vendor.findFirst).mockResolvedValue({ vendorId: 'ven-1' } as any);
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any);
    // desmarcar+upsert corren dentro de prisma.$transaction: el mock de la
    // transacción ejecuta el callback con mockTx.
    mockTx.proveedorProducto.upsert.mockResolvedValue({
      proveedorProductoId: 'pp-1',
      esPreferente: true,
    } as any);
    mockTx.proveedorProducto.updateMany.mockResolvedValue({
      count: 2,
    } as any);
  });

  it('al marcar preferente desmarca a los demás vendors del producto', async () => {
    await upsertProveedorProductoAction({
      vendorId: 'ven-1',
      productoId: 'prod-1',
      costoUnitario: 500,
      esPreferente: true,
    });

    // Desmarca primero (los otros vendors del mismo producto), dentro de
    // la misma transacción que el upsert...
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.proveedorProducto.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', productoId: 'prod-1' },
      data: { esPreferente: false },
    });
    // ...y después persiste el upsert con la marca.
    expect(mockTx.proveedorProducto.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          esPreferente: true,
          costoUnitario: 500,
        }),
        update: expect.objectContaining({ esPreferente: true }),
      }),
    );
  });

  it('sin esPreferente no desmarca a nadie', async () => {
    await upsertProveedorProductoAction({
      vendorId: 'ven-1',
      productoId: 'prod-1',
      costoUnitario: 450,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.proveedorProducto.updateMany).not.toHaveBeenCalled();
  });

  it('rechaza un proveedor que no pertenece al tenant autenticado', async () => {
    vi.mocked(prisma.vendor.findFirst).mockResolvedValue(null as any);
    const result = await upsertProveedorProductoAction({
      vendorId: 'ven-ajeno', productoId: 'prod-1', costoUnitario: 500,
    });
    expect(result.success).toBe(false);
    expect(prisma.proveedorProducto.upsert).not.toHaveBeenCalled();
  });

  it('rechaza un producto que no pertenece al tenant autenticado', async () => {
    vi.mocked(prisma.producto.findFirst).mockResolvedValue(null as any);
    const result = await upsertProveedorProductoAction({
      vendorId: 'ven-1', productoId: 'prod-ajeno', costoUnitario: 500,
    });
    expect(result.success).toBe(false);
    expect(prisma.proveedorProducto.upsert).not.toHaveBeenCalled();
  });
});

describe('F-3: setProveedorProductoPreferenteAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    prisma.proveedorProducto.findFirst.mockResolvedValue({
      proveedorProductoId: 'pp-1',
      tenantId: 'tenant-1',
      productoId: 'prod-1',
    } as any);
    mockTx.proveedorProducto.update.mockResolvedValue({
      esPreferente: true,
    } as any);
    mockTx.proveedorProducto.updateMany.mockResolvedValue({ count: 1 } as any);
  });

  it('marca el registro y desmarca el resto del producto', async () => {
    const result = await setProveedorProductoPreferenteAction('pp-1');

    expect(result.success).toBe(true);
    // Desmarcar y marcar corren en una sola transacción.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.proveedorProducto.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', productoId: 'prod-1' },
      data: { esPreferente: false },
    });
    expect(mockTx.proveedorProducto.update).toHaveBeenCalledWith({
      where: { proveedorProductoId: 'pp-1' },
      data: { esPreferente: true },
    });
  });

  it('rechaza registro ajeno al tenant', async () => {
    prisma.proveedorProducto.findFirst.mockResolvedValue(null as any);

    const result = await setProveedorProductoPreferenteAction('pp-ajeno');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });
});

describe('F-3: getProveedor360Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    vi.mocked(prisma.vendor.findFirst).mockResolvedValue({
      vendorId: 'ven-1',
      tenantId: 'tenant-1',
      nombre: 'Distribuidora X',
      vendorCode: 'DX',
    } as any);
    vi.mocked(prisma.proveedorProducto.findMany).mockResolvedValue([
      { proveedorProductoId: 'pp-1', productoId: 'prod-1', costoUnitario: 500 },
    ] as any);
    vi.mocked(prisma.compraDocumento.findMany).mockResolvedValue([
      { compraDocumentoId: 'cd-1', total: 12000, createdAt: new Date() },
    ] as any);
    vi.mocked(prisma.compraDocumento.groupBy).mockResolvedValue([
      { moneda: 'CUP', _sum: { total: 42000 } },
    ] as any);
    vi.mocked(prisma.cuentaPorPagar.findMany).mockResolvedValue([
      { cuentaPorPagarId: 'cxp-1', saldoPendiente: 3000 },
    ] as any);
    vi.mocked(prisma.anticipo.findMany).mockResolvedValue([]);
    vi.mocked(prisma.deudaCash.findMany).mockResolvedValue([]);
    vi.mocked(prisma.contrato.findMany).mockResolvedValue([]);
  });

  it('compone perfil, pricelist, compras, CxP y métricas tenant-scoped', async () => {
    const result = await getProveedor360Action('ven-1');

    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(data.vendor.vendorId).toBe('ven-1');
    expect(data.pricelist).toHaveLength(1);
    expect(data.comprasRecientes).toHaveLength(1);
    expect(data.cuentasPorPagar).toHaveLength(1);
    expect(data.metricas.totalComprado12Meses).toBe(42000);
    expect(data.metricas.totalesComprado12MesesPorMoneda).toEqual([
      { moneda: 'CUP', total: 42000 },
    ]);

    // Tenant scoping en cada consulta
    expect(prisma.proveedorProducto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    );
    expect(prisma.cuentaPorPagar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    );
  });

  it('no mezcla monedas en el total de 12 meses', async () => {
    vi.mocked(prisma.compraDocumento.groupBy).mockResolvedValue([
      { moneda: 'CUP', _sum: { total: 42000 } },
      { moneda: 'USD', _sum: { total: 150 } },
    ] as any);

    const result = await getProveedor360Action('ven-1');

    expect(result.success).toBe(true);
    const data = result.data as any;
    // El total principal es solo CUP; el resto va en el desglose.
    expect(data.metricas.totalComprado12Meses).toBe(42000);
    expect(data.metricas.totalesComprado12MesesPorMoneda).toEqual([
      { moneda: 'CUP', total: 42000 },
      { moneda: 'USD', total: 150 },
    ]);
  });

  it('rechaza proveedor ajeno al tenant', async () => {
    vi.mocked(prisma.vendor.findFirst).mockResolvedValue(null as any);

    const result = await getProveedor360Action('ven-otro-tenant');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });
});
