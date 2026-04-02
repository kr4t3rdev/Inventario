import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const executeAnticipoMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
  withAuthPost: (handler: any) => async (request: NextRequest, context: any) =>
    handler(request, context, { userId: 'user-123' }),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    puntoDeVenta: {
      findUnique: vi.fn(),
    },
    transferencia: {
      aggregate: vi.fn(),
    },
    ventaItem: {
      aggregate: vi.fn(),
    },
    venta: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    producto: {
      findUnique: vi.fn(),
    },
    precioProducto: {
      findUnique: vi.fn(),
    },
    ventaServicios: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
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
    const { POST } = await import('../route');
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
    prisma.venta.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prisma.producto.findUnique.mockResolvedValue({
      precioVenta: 100,
      nombre: 'Producto Demo',
    });

    const txVentaCreate = vi.fn().mockResolvedValue({
      ventaId: 'venta-1',
      cliente: { nombre: 'Cliente Demo' },
      puntoDeVenta: { nombre: 'PV Demo' },
      items: [],
    });
    const txSerieFindFirst = vi.fn().mockResolvedValue({
      serieId: 'serie-1',
      prefijo: 'SD',
      consecutivo: 1,
      activa: true,
    });
    const txSerieUpdate = vi.fn().mockResolvedValue({
      serieId: 'serie-1',
      consecutivo: 2,
    });
    const txFacturaCreate = vi.fn().mockRejectedValue(new Error('Factura error'));
    const txCuentaPorCobrarCreate = vi.fn();

    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        venta: {
          create: txVentaCreate,
        },
        serieFacturacion: {
          findFirst: txSerieFindFirst,
          create: vi.fn(),
          update: txSerieUpdate,
        },
        factura: {
          create: txFacturaCreate,
        },
        cuentaPorCobrar: {
          create: txCuentaPorCobrarCreate,
        },
      };
      return callback(tx);
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 })
    );

    const request = new NextRequest('http://localhost/api/ventas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productos: [{ productoId: 'prod-1', cantidad: 1 }],
        puntoDeVentaId: 'pv-1',
        clienteId: 'cli-1',
        descuento: 0,
        impuestos: 0,
        cargoTransporte: 0,
        observaciones: 'venta test',
        tipoVencimiento: 'credito',
        fechaVencimiento: '2026-03-01T00:00:00.000Z',
      }),
    });

    const response = await POST(request, {});
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Error al crear venta');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(txVentaCreate).toHaveBeenCalled();
    expect(txFacturaCreate).toHaveBeenCalled();
    expect(txCuentaPorCobrarCreate).not.toHaveBeenCalled();
    expect(executeAnticipoMock).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('debe usar precio de lista al crear venta única cuando el PV tiene lista asignada', async () => {
    const { POST } = await import('../route');
    const prisma = (await import('@/lib/prisma')).default as any;

    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: 'lp-1' });
    prisma.transferencia.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.puntoDeVentaDestinoId) {
        return { _sum: { cantidad: 10 } };
      }
      return { _sum: { cantidad: 0 } };
    });
    prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prisma.venta.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prisma.producto.findUnique.mockResolvedValue({
      id: 'prod-1',
      precioVenta: 100,
      nombre: 'Producto Demo',
    });
    prisma.precioProducto.findUnique.mockResolvedValue({ precio: 175 });

    const txVentaCreate = vi.fn().mockResolvedValue({
      ventaId: 'venta-1',
      cliente: null,
      puntoDeVenta: { nombre: 'PV Demo' },
      items: [],
    });

    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        venta: {
          create: txVentaCreate,
        },
      };
      return callback(tx);
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 })
    );

    const request = new NextRequest('http://localhost/api/ventas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productos: [{ productoId: 'prod-1', cantidad: 2, precioVenta: 175 }],
        puntoDeVentaId: 'pv-1',
        descuento: 0,
        impuestos: 0,
        cargoTransporte: 0,
      }),
    });

    const response = await POST(request, {});
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.productos[0].precioVenta).toBe(175);
    expect(txVentaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: 350,
          items: {
            create: [
              expect.objectContaining({
                precioUnitario: 175,
                total: 350,
              }),
            ],
          },
        }),
      }),
    );

    fetchSpy.mockRestore();
  });

  it('debe procesar venta mixta con productos y servicios', async () => {
    const { POST } = await import('../route');
    const prisma = (await import('@/lib/prisma')).default as any;

    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: null });
    prisma.transferencia.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.puntoDeVentaDestinoId) return { _sum: { cantidad: 10 } };
      return { _sum: { cantidad: 0 } };
    });
    prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prisma.venta.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prisma.producto.findUnique.mockResolvedValue({
      id: 'prod-1',
      precioVenta: 200,
      nombre: 'Producto Demo',
    });
    prisma.precioProducto.findUnique.mockResolvedValue(null);
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
    const { POST } = await import('../route');
    const prisma = (await import('@/lib/prisma')).default as any;

    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: null });
    prisma.precioProducto.findUnique.mockResolvedValue(null);
    prisma.transferencia.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.puntoDeVentaDestinoId) return { _sum: { cantidad: 100 } };
      return { _sum: { cantidad: 0 } };
    });
    prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prisma.venta.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prisma.producto.findUnique.mockResolvedValue({
      id: 'hijo-1',
      precioVenta: 50,
      nombre: 'Unidad del Pack',
      productoPadreId: 'padre-1',
      cantidadEnPack: 24,
    });

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
        producto: { update: txProductoUpdate },
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
    const { POST } = await import('../route');
    const prisma = (await import('@/lib/prisma')).default as any;

    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: null });
    prisma.precioProducto.findUnique.mockResolvedValue(null);
    prisma.transferencia.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.puntoDeVentaDestinoId) return { _sum: { cantidad: 100 } };
      return { _sum: { cantidad: 0 } };
    });
    prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prisma.venta.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prisma.producto.findUnique.mockResolvedValue({
      id: 'hijo-1',
      precioVenta: 50,
      nombre: 'Unidad del Pack',
      productoPadreId: 'padre-1',
      cantidadEnPack: 20,
    });

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
        producto: { update: txProductoUpdate },
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
