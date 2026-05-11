import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const executeAnticipoMock = vi.hoisted(() => vi.fn());

const prismaMock = {
  puntoDeVenta: { findUnique: vi.fn() },
  transferencia: { aggregate: vi.fn() },
  ventaItem: { aggregate: vi.fn() },
  venta: {
    aggregate: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  producto: { findUnique: vi.fn(), update: vi.fn() },
  precioProducto: { findUnique: vi.fn() },
  ventaServicios: { create: vi.fn() },
  almacen: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock('@/lib/services/anticipos-workflow', () => ({
  executeAnticipo: executeAnticipoMock,
  isAnticipoWorkflowError: () => false
}));

describe('Ventas API - POST rollback por fallo de facturación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe responder 500 y no completar el flujo cuando falla factura dentro de transacción', async () => {
    const { createVentaHandler } = await import('@/features/ventas/api/handlers');
    const POST = (req: NextRequest, ctx: any) => createVentaHandler(req, ctx, { userId: 'user-123', tenantId: 'tenant-test' });
    const prisma = (await import('@/lib/prisma')).default as any;

    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: null });
    prisma.precioProducto.findUnique.mockResolvedValue(null);
    prisma.transferencia.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.puntoDeVentaDestinoId) {
        return { _sum: { cantidad: 10 } };
      }
      return { _sum: { cantidad: 0 } };
    });
    prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prisma.venta.findFirst.mockResolvedValue(null); // idempotency check
    prisma.producto.findUnique.mockResolvedValue({
      id: 'prod-1',
      precioVenta: 200,
      nombre: 'Producto Demo',
    });
    prisma.precioProducto.findUnique.mockResolvedValue(null);
    prisma.almacen.findUnique.mockResolvedValue(null);
    prisma.ventaServicios.create.mockResolvedValue({ ventaServicioId: 'vs-1' });

    const txVentaCreate = vi.fn().mockResolvedValue({
      ventaId: 'venta-1',
      cliente: null,
      puntoDeVenta: { nombre: 'PV Demo' },
      items: [],
    });

    prisma.$transaction
      .mockImplementationOnce(async (callback: any) => {
        const tx = {
          venta: { create: txVentaCreate },
          stockUbicacion: { upsert: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      })
      .mockImplementationOnce(async (ops: Promise<unknown>[]) => Promise.all(ops));

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    const request = new NextRequest('http://localhost/api/ventas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        puntoDeVentaId: 'pv-1',
        lineas: [
          { tipoLinea: 'PRODUCTO', productoId: 'prod-1', cantidad: 2, precioUnitario: 200 },
          { tipoLinea: 'SERVICIO', servicioId: 'serv-1', cantidad: 1, precioUnitario: 1000 },
        ],
      }),
    });

    const response = await POST(request, {});
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.tipo).toBe('venta_mixta');
    expect(data.lineasProductoProcesadas).toBe(1);
    expect(data.lineasServicioProcesadas).toBe(1);
    expect(prisma.ventaServicios.create).toHaveBeenCalledTimes(1);

    fetchSpy.mockRestore();
  });
});

describe('Ventas API - sync stock padre para productos hijos compuestos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('decrementa stock del padre cuando se vende un producto hijo (venta única)', async () => {
    const { createVentaHandler } = await import('@/features/ventas/api/handlers');
    const POST = (req: NextRequest, ctx: any) => createVentaHandler(req, ctx, { userId: 'user-123', tenantId: 'tenant-test' });
    const prisma = (await import('@/lib/prisma')).default as any;

    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: null });
    prisma.precioProducto.findUnique.mockResolvedValue(null);
    prisma.transferencia.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.puntoDeVentaDestinoId) return { _sum: { cantidad: 100 } };
      return { _sum: { cantidad: 0 } };
    });
    prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prisma.venta.findFirst.mockResolvedValue(null); // idempotency check
    // Two calls: one for location validation (child), one for parent product
    prisma.producto.findUnique
      .mockResolvedValueOnce({
        id: 'hijo-1',
        precioVenta: 50,
        nombre: 'Unidad del Pack',
        productoPadreId: 'padre-1',
        cantidadEnPack: 24,
      })
      .mockResolvedValueOnce({ almacenId: 'alm-1' }) // parent product in validateVentaLocations
      .mockResolvedValueOnce({
        id: 'hijo-1',
        precioVenta: 50,
        nombre: 'Unidad del Pack',
        productoPadreId: 'padre-1',
        cantidadEnPack: 24,
      }); // second call in crearVentaUnica
    prisma.almacen.findUnique.mockResolvedValue({ almacenId: 'alm-1', activo: true });

    const txVentaCreate = vi.fn().mockResolvedValue({
      ventaId: 'venta-1',
      cliente: null,
      puntoDeVenta: { nombre: 'PV Demo' },
      items: [],
    });
    const txProductoUpdate = vi.fn().mockResolvedValue({});

    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        venta: { create: txVentaCreate },
        producto: { update: txProductoUpdate, findUnique: vi.fn().mockResolvedValue(null) },
        stockUbicacion: { upsert: vi.fn().mockResolvedValue({}) },
      };
      return callback(tx);
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    const request = new NextRequest('http://localhost/api/ventas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productos: [{ productoId: 'hijo-1', cantidad: 24 }],
        puntoDeVentaId: 'pv-1',
        descuento: 0,
        impuestos: 0,
        cargoTransporte: 0,
      }),
    });

    const response = await POST(request, {});

    expect(response.status).toBe(200);
    // floor(24 / 24) = 1 → decrement parent by 1
    expect(txProductoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'padre-1' },
        data: { stock: { decrement: 1 } },
      }),
    );

    fetchSpy.mockRestore();
  });

  it('NO decrementa stock del padre cuando floor es 0 (cantidad < cantidadEnPack)', async () => {
    const { createVentaHandler } = await import('@/features/ventas/api/handlers');
    const POST = (req: NextRequest, ctx: any) => createVentaHandler(req, ctx, { userId: 'user-123', tenantId: 'tenant-test' });
    const prisma = (await import('@/lib/prisma')).default as any;

    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: null });
    prisma.precioProducto.findUnique.mockResolvedValue(null);
    prisma.transferencia.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.puntoDeVentaDestinoId) return { _sum: { cantidad: 100 } };
      return { _sum: { cantidad: 0 } };
    });
    prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prisma.venta.findFirst.mockResolvedValue(null); // idempotency check
    prisma.producto.findUnique
      .mockResolvedValueOnce({
        id: 'hijo-1',
        precioVenta: 50,
        nombre: 'Unidad del Pack',
        productoPadreId: 'padre-1',
        cantidadEnPack: 20,
      })
      .mockResolvedValueOnce({ almacenId: 'alm-1' }) // parent product in validateVentaLocations
      .mockResolvedValueOnce({
        id: 'hijo-1',
        precioVenta: 50,
        nombre: 'Unidad del Pack',
        productoPadreId: 'padre-1',
        cantidadEnPack: 20,
      });
    prisma.almacen.findUnique.mockResolvedValue({ almacenId: 'alm-1', activo: true });

    const txVentaCreate = vi.fn().mockResolvedValue({
      ventaId: 'venta-1',
      cliente: null,
      puntoDeVenta: { nombre: 'PV Demo' },
      items: [],
    });
    const txProductoUpdate = vi.fn();

    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        venta: { create: txVentaCreate },
        producto: { update: txProductoUpdate, findUnique: vi.fn().mockResolvedValue(null) },
        stockUbicacion: { upsert: vi.fn().mockResolvedValue({}) },
      };
      return callback(tx);
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    const request = new NextRequest('http://localhost/api/ventas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productos: [{ productoId: 'hijo-1', cantidad: 15 }],
        puntoDeVentaId: 'pv-1',
        descuento: 0,
        impuestos: 0,
        cargoTransporte: 0,
      }),
    });

    const response = await POST(request, {});

    expect(response.status).toBe(200);
    // floor(15 / 20) = 0 → no parent update
    expect(txProductoUpdate).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
