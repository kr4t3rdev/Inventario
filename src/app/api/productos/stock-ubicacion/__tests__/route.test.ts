import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  producto: {
    findMany: vi.fn(),
  },
  transferencia: {
    findMany: vi.fn(),
  },
  ventaItem: {
    findMany: vi.fn(),
  },
  venta: {
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
  withAuthPost: (handler: any) => handler,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

describe('API /productos/stock-ubicacion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('usa el stock del almacén sin volver a sumar transferencias', async () => {
    const { GET } = await import('../route')

    prismaMock.producto.findMany.mockResolvedValue([
      {
        id: 'prod-1',
        nombre: 'Producto 1',
        descripcion: null,
        codigoInterno: '12345678901',
        precioCosto: 100,
        precioVenta: 150,
        stock: 80,
        stockMinimo: 0,
        categoriaId: 'cat-1',
        subcategoriaId: null,
        unidadId: 'unit-1',
        vendorId: 'vendor-1',
        almacenId: 'alm-1',
        fotos: ['foto-1.jpg'],
        categoria: { catId: 'cat-1', nombre: 'Bebidas' },
        subcategoria: null,
        unidad: { unidadId: 'unit-1', nombre: 'Unidad', simbolo: 'u' },
        vendor: { vendorId: 'vendor-1', nombre: 'Proveedor Test' },
      },
    ])
    prismaMock.transferencia.findMany.mockResolvedValue([{ productoId: 'prod-1', cantidad: 20 }])

    const request = new NextRequest(
      'http://localhost/api/productos/stock-ubicacion?ubicacionId=alm-1&tipoUbicacion=almacen&includeZero=true',
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].stockUbicacion).toBe(80)
    expect(data[0].codigoInterno).toBe('12345678901')
    expect(data[0].descripcion).toBeNull()
    expect(data[0].vendor?.nombre).toBe('Proveedor Test')
    expect(data[0].unidad?.simbolo).toBe('u')
    expect(data[0].fotos).toEqual(['foto-1.jpg'])
    expect(prismaMock.transferencia.findMany).not.toHaveBeenCalled()
    expect(prismaMock.ventaItem.findMany).not.toHaveBeenCalled()
    expect(prismaMock.venta.findMany).not.toHaveBeenCalled()
  })

  it('sigue calculando el stock del punto de venta con movimientos y ventas', async () => {
    const { GET } = await import('../route')

    prismaMock.producto.findMany.mockResolvedValue([
      {
        id: 'prod-2',
        nombre: 'Producto 2',
        descripcion: null,
        codigoInterno: null,
        precioCosto: 200,
        precioVenta: 300,
        stock: 999,
        stockMinimo: 0,
        categoriaId: 'cat-1',
        subcategoriaId: null,
        unidadId: null,
        vendorId: null,
        almacenId: 'alm-1',
        fotos: [],
        categoria: { catId: 'cat-1', nombre: 'Bebidas' },
        subcategoria: null,
        unidad: null,
        vendor: null,
      },
    ])
    prismaMock.transferencia.findMany
      .mockResolvedValueOnce([{ productoId: 'prod-2', cantidad: 12 }])
      .mockResolvedValueOnce([{ productoId: 'prod-2', cantidad: 2 }])
    prismaMock.ventaItem.findMany.mockResolvedValue([{ productoId: 'prod-2', cantidad: 3 }])
    prismaMock.venta.findMany.mockResolvedValue([{ productoId: 'prod-2', cantidad: 1 }])

    const request = new NextRequest(
      'http://localhost/api/productos/stock-ubicacion?ubicacionId=pv-1&tipoUbicacion=punto_venta&includeZero=true',
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data[0].stockUbicacion).toBe(6)
    expect(prismaMock.transferencia.findMany).toHaveBeenCalledTimes(2)
    expect(prismaMock.ventaItem.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.venta.findMany).toHaveBeenCalledTimes(1)
  })
})