import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: vi.fn((handler) => (request: NextRequest, context: unknown) =>
    handler(request, context, {
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      isActive: true,
      tenantId: 'tenant-1',
    }),
  ),
}));

vi.mock('@/lib/api/productos-ubicacion', () => ({
  getProductosPorUbicacion: vi.fn(),
}));

import { ServerActionError } from '@/lib/api/errors';
import { getProductosPorUbicacion } from '@/lib/api/productos-ubicacion';
import { GET } from './route';

describe('/api/ventas/punto-venta/[puntoDeVentaId]/productos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the canonical productos payload for the selected punto de venta', async () => {
    vi.mocked(getProductosPorUbicacion).mockResolvedValue([
      {
        id: 'prod-1',
        nombre: 'Producto 1',
        descripcion: null,
        precioCosto: 100,
        precioVenta: 120,
        precioVentaResuelto: 120,
        precioFuente: 'BASE',
        listaPrecioIdAplicada: 'lista-1',
        stock: 5,
        stockEnUbicacion: 5,
        fotos: [],
        categoriaId: 'cat-1',
        unidadId: 'unidad-1',
        vendorId: 'vendor-1',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ] as never);

    const response = await GET(
      new NextRequest('http://localhost/api/ventas/punto-venta/pv-1/productos'),
      { params: Promise.resolve({ puntoDeVentaId: 'pv-1' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.productos).toHaveLength(1);
    expect(data.productos[0]).toMatchObject({ id: 'prod-1', stockEnUbicacion: 5 });
    expect(getProductosPorUbicacion).toHaveBeenCalledWith('pv-1');
  });

  it('maps missing locations to 404 without leaking a server action failure', async () => {
    vi.mocked(getProductosPorUbicacion).mockRejectedValue(
      new ServerActionError('getProductosPorUbicacion', 'GET', 404, 'Ubicación no encontrada'),
    );

    const response = await GET(
      new NextRequest('http://localhost/api/ventas/punto-venta/invalid/productos'),
      { params: Promise.resolve({ puntoDeVentaId: 'invalid' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toMatchObject({ error: 'Ubicación no encontrada', code: 'LOCATION_NOT_FOUND' });
  });
});
