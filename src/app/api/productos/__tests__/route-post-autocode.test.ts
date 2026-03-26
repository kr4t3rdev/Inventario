import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mockPrisma = {
  vendor: {
    findUnique: vi.fn(),
  },
  categoria: {
    findUnique: vi.fn(),
  },
  producto: {
    findFirst: vi.fn(),
  },
  gastoCompra: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: unknown) => handler,
  withAuthPost: (handler: unknown) => handler,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

const { POST } = await import('../route')

describe('POST /api/productos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.vendor.findUnique.mockResolvedValue(null)
    mockPrisma.categoria.findUnique.mockResolvedValue(null)
  })

  it('rechaza segmentos manuales enviados por el cliente', async () => {
    const request = new Request('http://localhost/api/productos', {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Caja de cigarros',
        descripcion: 'Demo',
        vendorId: 'vendor-1',
        idSeccionCodigo: '14',
        categoriaId: 'cat-1',
        subcategoriaId: 'sub-1',
        precioCosto: 100,
        precioVenta: 150,
        stock: 10,
        stockMinimo: 0,
        fotos: [],
        unidadId: 'u1',
        almacenId: 'a1',
      }),
    }) as NextRequest

    const response = await POST(request, {} as never, {} as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toMatch(/generan automáticamente/i)
    expect(mockPrisma.categoria.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('devuelve 400 cuando la taxonomía no está mapeada', async () => {
    mockPrisma.vendor.findUnique.mockResolvedValue({
      vendorId: 'vendor-1',
      productos: [{ proveedorCodigo: '01' }],
    })

    mockPrisma.categoria.findUnique
      .mockResolvedValueOnce({ catId: 'cat-1', nombre: 'CategoriaDesconocida' })
      .mockResolvedValueOnce({
        catId: 'sub-1',
        nombre: 'SubcategoriaDesconocida',
        parentId: 'cat-1',
      })

    const request = new Request('http://localhost/api/productos', {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Caja de cigarros',
        descripcion: 'Demo',
        vendorId: 'vendor-1',
        categoriaId: 'cat-1',
        subcategoriaId: 'sub-1',
        precioCosto: 100,
        precioVenta: 150,
        stock: 10,
        stockMinimo: 0,
        fotos: [],
        unidadId: 'u1',
        almacenId: 'a1',
      }),
    }) as NextRequest

    const response = await POST(request, {} as never, {} as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toMatch(/no encontrada en mapeo/i)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('genera código padre e hijo cuando el producto es compuesto usando vendorId como contrato primario', async () => {
    const tx = {
      producto: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ surtidoCodigo: '0001' }]),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 'padre-1', codigoNegocio: '0114028500012' })
          .mockResolvedValueOnce({ id: 'hijo-1', codigoNegocio: '0114028500029' }),
      },
    }

    mockPrisma.vendor.findUnique.mockResolvedValue({
      vendorId: 'vendor-1',
      productos: [{ proveedorCodigo: '01' }],
    })

    mockPrisma.categoria.findUnique
      .mockResolvedValueOnce({ catId: 'cat-1', nombre: 'Bebidas' })
      .mockResolvedValueOnce({
        catId: 'sub-1',
        nombre: 'Bebidas_Alcoholicas',
        parentId: 'cat-1',
      })

    mockPrisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => {
      return callback(tx)
    })

    const request = new Request('http://localhost/api/productos', {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Caja de cigarros',
        descripcion: 'Demo',
        vendorId: 'vendor-1',
        categoriaId: 'cat-1',
        subcategoriaId: 'sub-1',
        precioCosto: 400,
        precioVenta: 500,
        stock: 10,
        stockMinimo: 0,
        fotos: [],
        unidadId: 'u1',
        almacenId: 'a1',
        esCompuesto: true,
        cantidadEnPack: 20,
        nombreHijo: 'Cigarro (unidad)',
      }),
    }) as NextRequest

    const response = await POST(request, {} as never, {} as never)
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.producto.codigoNegocio).toBe('0114028500012')
    expect(payload.productoHijo.codigoNegocio).toBe('0114028500029')
    expect(tx.producto.create).toHaveBeenCalledTimes(2)
  })
})
