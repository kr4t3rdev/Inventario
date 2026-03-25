import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  default: {
    puntoDeVenta: {
      findUnique: vi.fn(),
    },
    almacen: {
      findUnique: vi.fn(),
    },
    producto: {
      findMany: vi.fn(),
    },
    transferencia: {
      aggregate: vi.fn(),
    },
    ventaItem: {
      aggregate: vi.fn(),
    },
    venta: {
      aggregate: vi.fn(),
    },
    precioProducto: {
      findMany: vi.fn(),
    },
  },
}));

describe('GET /api/productos/por-ubicacion/[ubicacionId] pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aplica precio de lista cuando existe precio específico', async () => {
    const { GET } = await import('../route');
    const prisma = (await import('@/lib/prisma')).default as any;

    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: 'lp-1' });
    prisma.producto.findMany.mockResolvedValue([
      {
        id: 'prod-1',
        nombre: 'Producto 1',
        descripcion: null,
        precioCosto: 70,
        precioVenta: 100,
        stock: 20,
        fotos: [],
        categoriaId: 'cat-1',
        unidadId: 'u-1',
        vendorId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        categoria: null,
        unidad: null,
        vendor: null,
      },
    ]);
    prisma.precioProducto.findMany.mockResolvedValue([{ productoId: 'prod-1', precio: 150 }]);
    prisma.transferencia.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.puntoDeVentaDestinoId) {
        return { _sum: { cantidad: 10 } };
      }
      return { _sum: { cantidad: 0 } };
    });
    prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prisma.venta.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });

    const req = new NextRequest('http://localhost/api/productos/por-ubicacion/pv-1');
    const response = await GET(req, { params: Promise.resolve({ ubicacionId: 'pv-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].precioVentaResuelto).toBe(150);
    expect(data[0].precioFuente).toBe('LISTA');
    expect(data[0].listaPrecioIdAplicada).toBe('lp-1');
  });

  it('usa fallback al precio base cuando no existe precio por lista', async () => {
    const { GET } = await import('../route');
    const prisma = (await import('@/lib/prisma')).default as any;

    prisma.puntoDeVenta.findUnique.mockResolvedValue({ pvId: 'pv-1', listaPrecioId: 'lp-1' });
    prisma.producto.findMany.mockResolvedValue([
      {
        id: 'prod-1',
        nombre: 'Producto 1',
        descripcion: null,
        precioCosto: 70,
        precioVenta: 100,
        stock: 20,
        fotos: [],
        categoriaId: 'cat-1',
        unidadId: 'u-1',
        vendorId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        categoria: null,
        unidad: null,
        vendor: null,
      },
    ]);
    prisma.precioProducto.findMany.mockResolvedValue([]);
    prisma.transferencia.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.puntoDeVentaDestinoId) {
        return { _sum: { cantidad: 10 } };
      }
      return { _sum: { cantidad: 0 } };
    });
    prisma.ventaItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });
    prisma.venta.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } });

    const req = new NextRequest('http://localhost/api/productos/por-ubicacion/pv-1');
    const response = await GET(req, { params: Promise.resolve({ ubicacionId: 'pv-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data[0].precioVentaResuelto).toBe(100);
    expect(data[0].precioFuente).toBe('BASE');
  });
});
