import { NextRequest } from 'next/server'
import { GET } from '../route'
import { vi } from 'vitest'

// Mock Prisma con vi.hoisted para evitar problemas de hoisting
const prismaMock = vi.hoisted(() => ({
  gastoCompra: {
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

describe('/api/gastos-compra - Restock Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockGastosCompra = [
    {
      id: 'gc1',
      productoId: 'prod1',
      vendorId: 'vendor1',
      cantidad: 10,
      precioUnitario: 100,
      total: 1000,
      fechaCompra: new Date('2024-01-15'),
      descripcion: 'Restock - Test Product',
      producto: {
        id: 'prod1',
        nombre: 'Test Product',
        categoria: { catId: 'cat1', nombre: 'Category 1' },
        unidad: { unidadId: 'unit1', nombre: 'Unit 1', simbolo: 'u' },
      },
      vendor: {
        vendorId: 'vendor1',
        nombre: 'Test Vendor',
      },
    },
    {
      id: 'gc2',
      productoId: 'prod2',
      vendorId: 'vendor2',
      cantidad: 5,
      precioUnitario: 200,
      total: 1000,
      fechaCompra: new Date('2024-01-16'),
      descripcion: 'Regular purchase - Test Product 2',
      producto: {
        id: 'prod2',
        nombre: 'Test Product 2',
        categoria: { catId: 'cat2', nombre: 'Category 2' },
        unidad: { unidadId: 'unit2', nombre: 'Unit 2', simbolo: 'kg' },
      },
      vendor: {
        vendorId: 'vendor2',
        nombre: 'Test Vendor 2',
      },
    },
  ]

  const restockGastos = mockGastosCompra.filter(
    g => g.descripcion.includes('Restock')
  )

  const regularGastos = mockGastosCompra.filter(
    g => !g.descripcion.includes('Restock')
  )

  it('should return all gastos-compra', async () => {
    prismaMock.gastoCompra.findMany.mockResolvedValue(mockGastosCompra)

    const request = new NextRequest('http://localhost/api/gastos-compra')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(prismaMock.gastoCompra.findMany).toHaveBeenCalledWith({
      include: {
        producto: {
          include: {
            categoria: true,
            unidad: true,
          },
        },
        vendor: true,
      },
    })
  })

  it('should filter restock entries', async () => {
    prismaMock.gastoCompra.findMany.mockResolvedValue(restockGastos)

    const request = new NextRequest('http://localhost/api/gastos-compra?type=restock')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].descripcion).toContain('Restock')
    expect(prismaMock.gastoCompra.findMany).toHaveBeenCalledWith({
      where: {
        descripcion: {
          contains: 'Restock',
        },
      },
      include: {
        producto: {
          include: {
            categoria: true,
            unidad: true,
          },
        },
        vendor: true,
      },
    })
  })

  it('should filter regular purchases', async () => {
    prismaMock.gastoCompra.findMany.mockResolvedValue(regularGastos)

    const request = new NextRequest('http://localhost/api/gastos-compra?type=regular')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].descripcion).not.toContain('Restock')
    expect(prismaMock.gastoCompra.findMany).toHaveBeenCalledWith({
      where: {
        NOT: {
          descripcion: {
            contains: 'Restock',
          },
        },
      },
      include: {
        producto: {
          include: {
            categoria: true,
            unidad: true,
          },
        },
        vendor: true,
      },
    })
  })

  it('should filter by product', async () => {
    const filteredGastos = mockGastosCompra.filter(g => g.productoId === 'prod1')
    prismaMock.gastoCompra.findMany.mockResolvedValue(filteredGastos)

    const request = new NextRequest('http://localhost/api/gastos-compra?productoId=prod1')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].productoId).toBe('prod1')
    expect(prismaMock.gastoCompra.findMany).toHaveBeenCalledWith({
      where: {
        productoId: 'prod1',
      },
      include: {
        producto: {
          include: {
            categoria: true,
            unidad: true,
          },
        },
        vendor: true,
      },
    })
  })

  it('should handle database errors', async () => {
    prismaMock.gastoCompra.findMany.mockRejectedValue(new Error('Database error'))

    const request = new NextRequest('http://localhost/api/gastos-compra')
    const response = await GET(request)

    expect(response.status).toBe(500)
  })

  it('should handle empty results', async () => {
    prismaMock.gastoCompra.findMany.mockResolvedValue([])

    const request = new NextRequest('http://localhost/api/gastos-compra')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(0)
  })
})
