import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getProductosPorUbicacion } from './productos-ubicacion'
import type { ProductoConStock } from '@/lib/redux/services/productosUbicacionApi'

// Mocks
vi.mock('@/lib/api/client', () => ({
  getAuthenticatedContext: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    puntoDeVenta: { findUnique: vi.fn() },
    almacen: { findUnique: vi.fn() },
    producto: { findMany: vi.fn() },
    precioProducto: { findMany: vi.fn() },
    transferencia: { aggregate: vi.fn() },
    ventaItem: { aggregate: vi.fn() },
    venta: { aggregate: vi.fn() },
  },
}))

import { getAuthenticatedContext } from '@/lib/api/client'
import prisma from '@/lib/prisma'
import { ServerActionError } from './errors'

describe('getProductosPorUbicacion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthenticatedContext).mockResolvedValue({ userId: 'user-1' })
  })

  it('should throw ServerActionError when location not found', async () => {
    vi.mocked(prisma.puntoDeVenta.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.almacen.findUnique).mockResolvedValue(null)

    try {
      await getProductosPorUbicacion('invalid-id')
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ServerActionError)
      expect((error as ServerActionError).status).toBe(404)
    }
  })

  it('should return products for punto de venta location', async () => {
    const mockPV = { pvId: 'pv-1', listaPrecioId: 'lp-1' }
    const mockProducts = [
      {
        id: 'prod-1',
        nombre: 'Producto 1',
        descripcion: 'Desc',
        precioCosto: 100,
        precioVenta: 150,
        stock: 10,
        fotos: [],
        categoriaId: 'cat-1',
        unidadId: 'und-1',
        vendorId: 'v-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        categoria: { catId: 'cat-1', nombre: 'Categoria' },
        unidad: { unidadId: 'und-1', nombre: 'Unidad', simbolo: 'U' },
        vendor: { vendorId: 'v-1', nombre: 'Vendor' },
      },
    ]

    vi.mocked(prisma.puntoDeVenta.findUnique).mockResolvedValue(mockPV as any)
    vi.mocked(prisma.producto.findMany).mockResolvedValue(mockProducts as any)
    vi.mocked(prisma.precioProducto.findMany).mockResolvedValue([
      { productoId: 'prod-1', precio: 160 },
    ] as any)
    vi.mocked(prisma.transferencia.aggregate)
      .mockResolvedValueOnce({ _sum: { cantidad: 20 } } as any)  // entrada
      .mockResolvedValueOnce({ _sum: { cantidad: 5 } } as any)   // salida
    vi.mocked(prisma.ventaItem.aggregate).mockResolvedValue({ _sum: { cantidad: 3 } } as any)
    vi.mocked(prisma.venta.aggregate).mockResolvedValue({ _sum: { cantidad: 1 } } as any)

    const result = await getProductosPorUbicacion('pv-1')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('prod-1')
    expect(result[0].stockEnUbicacion).toBe(11) // 20 - 5 - (3 + 1)
    expect(result[0].precioVentaResuelto).toBe(160)
    expect(result[0].precioFuente).toBe('LISTA')
  })

  it('should return products for almacen location', async () => {
    const mockAlmacen = { almacenId: 'alm-1', nombre: 'Almacen 1' }
    const mockProducts = [
      {
        id: 'prod-1',
        nombre: 'Producto 1',
        descripcion: null,
        precioCosto: 100,
        precioVenta: 150,
        stock: 50,
        fotos: [],
        categoriaId: 'cat-1',
        unidadId: 'und-1',
        vendorId: 'v-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        categoria: { catId: 'cat-1', nombre: 'Cat' },
        unidad: { unidadId: 'und-1', nombre: 'Unidad', simbolo: 'U' },
        vendor: null,
      },
    ]

    vi.mocked(prisma.puntoDeVenta.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.almacen.findUnique).mockResolvedValue(mockAlmacen as any)
    vi.mocked(prisma.producto.findMany).mockResolvedValue(mockProducts as any)
    vi.mocked(prisma.transferencia.aggregate)
      .mockResolvedValueOnce({ _sum: { cantidad: 10 } } as any)  // entrada
      .mockResolvedValueOnce({ _sum: { cantidad: 5 } } as any)   // salida

    const result = await getProductosPorUbicacion('alm-1')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('prod-1')
    expect(result[0].stockEnUbicacion).toBe(55) // 50 + 10 - 5
    expect(result[0].precioFuente).toBe('BASE')
  })

  it('should return correct type ProductoConStock[]', async () => {
    const mockPV = { pvId: 'pv-1', listaPrecioId: null }
    const mockProducts = [{
      id: 'prod-1',
      nombre: 'Test',
      descripcion: null,
      precioCosto: 50,
      precioVenta: 80,
      stock: 5,
      fotos: [],
      categoriaId: 'cat-1',
      unidadId: 'und-1',
      vendorId: 'v-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      categoria: null,
      unidad: null,
      vendor: null,
    }]

    vi.mocked(prisma.puntoDeVenta.findUnique).mockResolvedValue(mockPV as any)
    vi.mocked(prisma.producto.findMany).mockResolvedValue(mockProducts as any)
    vi.mocked(prisma.precioProducto.findMany).mockResolvedValue([])
    vi.mocked(prisma.transferencia.aggregate)
      .mockResolvedValue({ _sum: { cantidad: 0 } } as any)
    vi.mocked(prisma.ventaItem.aggregate).mockResolvedValue({ _sum: { cantidad: 0 } } as any)
    vi.mocked(prisma.venta.aggregate).mockResolvedValue({ _sum: { cantidad: 0 } } as any)

    const result: ProductoConStock[] = await getProductosPorUbicacion('pv-1')
    expect(Array.isArray(result)).toBe(true)
  })
})
