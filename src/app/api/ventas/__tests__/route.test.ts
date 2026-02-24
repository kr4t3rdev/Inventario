import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

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
    $transaction: vi.fn(),
  },
}));

describe('Ventas API - POST rollback por fallo de facturación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe responder 500 y no completar el flujo cuando falla factura dentro de transacción', async () => {
    const { POST } = await import('../route');
    const prisma = (await import('@/lib/prisma')).default as any;

    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1' });
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
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
