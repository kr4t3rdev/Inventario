import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  default: {
    oferta: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

describe('Facturar oferta API - POST rollback por fallo de facturación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe responder 500 cuando falla factura en transacción y no continuar con CxC', async () => {
    const { POST } = await import('../route');
    const prisma = (await import('@/lib/prisma')).default as any;
    const { authenticateUser } = await import('@/lib/auth-middleware');

    vi.mocked(authenticateUser).mockResolvedValue({ user: { userId: 'user-123' } } as any);

    prisma.oferta.findUnique.mockResolvedValue({
      id: 'oferta-1',
      numeroOferta: 'OF-1',
      estado: 'ACEPTADA',
      clienteId: 'cli-1',
      subtotal: 100,
      impuestos: 0,
      total: 100,
      items: [
        {
          productoId: 'prod-1',
          cantidad: 1,
          precioUnitario: 100,
          total: 100,
        },
      ],
    });

    const txVentaCreate = vi.fn().mockResolvedValue({ ventaId: 'venta-1' });
    const txOfertaUpdate = vi.fn().mockResolvedValue({ id: 'oferta-1' });
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
        oferta: {
          update: txOfertaUpdate,
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

    const request = new NextRequest('http://localhost/api/ofertas/oferta-1/facturar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        puntoDeVentaId: 'pv-1',
        observaciones: 'facturar oferta test',
        cargoTransporte: 0,
        tipoVencimiento: 'credito',
        fechaVencimiento: '2026-03-01T00:00:00.000Z',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'oferta-1' }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Error facturando oferta');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(txVentaCreate).toHaveBeenCalled();
    expect(txOfertaUpdate).toHaveBeenCalled();
    expect(txFacturaCreate).toHaveBeenCalled();
    expect(txCuentaPorCobrarCreate).not.toHaveBeenCalled();
  });
});
