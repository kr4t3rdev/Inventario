import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  producto: {
    findMany: vi.fn(),
  },
  stockUbicacion: {
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

describe('API /productos/stock-ubicacion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 400 si falta ubicacionId', async () => {
    const { GET } = await import('../route')

    const request = new NextRequest(
      'http://localhost/api/productos/stock-ubicacion?tipoUbicacion=almacen',
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('ubicacionId y tipoUbicacion son requeridos')
    expect(prismaMock.stockUbicacion.findMany).not.toHaveBeenCalled()
  })

  it('retorna 400 si tipoUbicacion es inválido', async () => {
    const { GET } = await import('../route')

    const request = new NextRequest(
      'http://localhost/api/productos/stock-ubicacion?ubicacionId=alm-1&tipoUbicacion=invalido',
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('tipoUbicacion inválido')
    expect(prismaMock.stockUbicacion.findMany).not.toHaveBeenCalled()
  })

  it('lee directamente de StockUbicacion para un almacén', async () => {
    const { GET } = await import('../route')

    prismaMock.stockUbicacion.findMany.mockResolvedValue([
      {
        id: 'su-1',
        productoId: 'prod-1',
        tipoUbicacion: 'almacen',
        ubicacionId: 'alm-1',
        cantidad: 80,
        cantidadReservada: 0,
        cantidadDisponible: 80,
        createdAt: new Date(),
        updatedAt: new Date(),
        producto: {
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
      },
    ])
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

    const request = new NextRequest(
      'http://localhost/api/productos/stock-ubicacion?ubicacionId=alm-1&tipoUbicacion=almacen&includeZero=true',
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].stockUbicacion).toBe(80)
    expect(data[0].stockTotal).toBe(80)
    expect(data[0].codigoInterno).toBe('12345678901')
    expect(data[0].descripcion).toBeNull()
    expect(data[0].vendor?.nombre).toBe('Proveedor Test')
    expect(data[0].unidad?.simbolo).toBe('u')
    expect(data[0].fotos).toEqual(['foto-1.jpg'])
    expect(prismaMock.stockUbicacion.findMany).toHaveBeenCalledOnce()
    expect(prismaMock.producto.findMany).toHaveBeenCalledOnce()
    expect(prismaMock.stockUbicacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ubicacionId: 'alm-1', tipoUbicacion: 'almacen' }),
      }),
    )
    expect(prismaMock.producto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { almacenId: 'alm-1' },
      }),
    )
  })

  it('lee directamente de StockUbicacion para un punto de venta', async () => {
    const { GET } = await import('../route')

    prismaMock.stockUbicacion.findMany.mockResolvedValue([
      {
        id: 'su-2',
        productoId: 'prod-2',
        tipoUbicacion: 'punto_venta',
        ubicacionId: 'pv-1',
        cantidad: 6,
        cantidadReservada: 0,
        cantidadDisponible: 6,
        createdAt: new Date(),
        updatedAt: new Date(),
        producto: {
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
      },
    ])
    prismaMock.producto.findMany.mockResolvedValue([])

    const request = new NextRequest(
      'http://localhost/api/productos/stock-ubicacion?ubicacionId=pv-1&tipoUbicacion=punto_venta&includeZero=true',
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data[0].stockUbicacion).toBe(6)
    expect(data[0].stockTotal).toBe(999)
    expect(prismaMock.stockUbicacion.findMany).toHaveBeenCalledOnce()
    expect(prismaMock.producto.findMany).toHaveBeenCalledOnce()
  })

  it('completa stockUbicacion en 0 cuando includeZero=true y no hay filas materializadas', async () => {
    const { GET } = await import('../route')

    prismaMock.stockUbicacion.findMany.mockResolvedValue([])
    prismaMock.producto.findMany.mockResolvedValue([
      {
        id: 'prod-1',
        nombre: 'Producto sin materializar',
        descripcion: null,
        codigoInterno: 'ABC-1',
        precioCosto: 100,
        precioVenta: 150,
        stock: 0,
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

    const request = new NextRequest(
      'http://localhost/api/productos/stock-ubicacion?ubicacionId=alm-1&tipoUbicacion=almacen&includeZero=true',
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe('prod-1')
    expect(data[0].stockUbicacion).toBe(0)
    expect(data[0].stockTotal).toBe(0)
    expect(prismaMock.stockUbicacion.findMany).toHaveBeenCalledOnce()
    expect(prismaMock.producto.findMany).toHaveBeenCalledOnce()
  })

  it('filtra registros con cantidad 0 cuando includeZero no está presente', async () => {
    const { GET } = await import('../route')

    prismaMock.stockUbicacion.findMany.mockResolvedValue([])

    const request = new NextRequest(
      'http://localhost/api/productos/stock-ubicacion?ubicacionId=alm-1&tipoUbicacion=almacen',
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(0)
    expect(prismaMock.producto.findMany).not.toHaveBeenCalled()
    expect(prismaMock.stockUbicacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cantidad: { gt: 0 } }),
      }),
    )
  })

  it('maneja errores de base de datos con 500', async () => {
    const { GET } = await import('../route')

    prismaMock.stockUbicacion.findMany.mockRejectedValue(new Error('DB connection error'))

    const request = new NextRequest(
      'http://localhost/api/productos/stock-ubicacion?ubicacionId=alm-1&tipoUbicacion=almacen',
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Error interno del servidor al calcular stock')
  })
})
