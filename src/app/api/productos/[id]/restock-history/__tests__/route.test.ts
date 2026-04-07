import { NextRequest } from 'next/server'
import { GET } from '../route'
import { vi } from 'vitest'

// Mock dependencies with vi.hoisted to avoid hoisting issues
const prismaMock = vi.hoisted(() => ({
  producto: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  gastoCompra: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}))

const authMock = vi.hoisted(() => ({
  verify_token: vi.fn(),
}))

vi.mock('../../../../../../lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

vi.mock('../../../../../../lib/auth-utils', () => ({
  verify_token: authMock.verify_token,
}))

describe('/api/productos/[id]/restock-history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockUser = { userId: 'user1', role: 'admin' }
  const mockProduct = {
    id: 'prod1',
    nombre: 'Test Product',
    precioCosto: 100,
    precioVenta: 150,
    stock: 50
  }

  const mockRelatedProducts = [
    {
      id: 'prod1',
      nombre: 'Test Product',
      precioCosto: 100,
      precioVenta: 150,
      createdAt: new Date('2024-01-01')
    },
    {
      id: 'prod2',
      nombre: 'Test Product',
      precioCosto: 110,
      precioVenta: 160,
      createdAt: new Date('2024-01-15')
    }
  ]

  const mockRestockEntries = [
    {
      gastoCompraId: 'gasto1',
      productoId: 'prod1',
      cantidad: 10,
      total: 1000,
      fechaCompra: new Date('2024-01-10'),
      descripcion: 'Restock - Test Product',
      producto: {
        id: 'prod1',
        nombre: 'Test Product',
        precioCosto: 100,
        precioVenta: 150
      },
      vendor: {
        nombre: 'Test Vendor',
        contacto: 'test@vendor.com'
      }
    },
    {
      gastoCompraId: 'gasto2',
      productoId: 'prod2',
      cantidad: 20,
      total: 2200,
      fechaCompra: new Date('2024-01-20'),
      descripcion: 'Restock - Test Product (Nueva instancia por cambio de precios)',
      producto: {
        id: 'prod2',
        nombre: 'Test Product',
        precioCosto: 110,
        precioVenta: 160
      },
      vendor: {
        nombre: 'Test Vendor',
        contacto: 'test@vendor.com'
      }
    }
  ]

  it('should return restock history successfully', async () => {
    authMock.verify_token.mockResolvedValue(mockUser)
    prismaMock.producto.findUnique.mockResolvedValue(mockProduct)
    prismaMock.producto.findMany.mockResolvedValue(mockRelatedProducts)
    prismaMock.gastoCompra.findMany.mockResolvedValue(mockRestockEntries)
    prismaMock.gastoCompra.count.mockResolvedValue(2)

    const request = new NextRequest('http://localhost/api/productos/prod1/restock-history')
    const response = await GET(request, { params: { id: 'prod1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.history).toHaveLength(2)
    expect(data.pagination.totalItems).toBe(2)
    expect(data.summary.totalRestocks).toBe(2)
    expect(data.summary.totalQuantityAdded).toBe(30)
    expect(data.summary.totalCostSpent).toBe(3200)
  })

  it('should handle pagination correctly', async () => {
    authMock.verify_token.mockResolvedValue(mockUser)
    prismaMock.producto.findUnique.mockResolvedValue(mockProduct)
    prismaMock.producto.findMany.mockResolvedValue(mockRelatedProducts)
    prismaMock.gastoCompra.findMany.mockResolvedValue([mockRestockEntries[0]])
    prismaMock.gastoCompra.count.mockResolvedValue(2)

    const request = new NextRequest('http://localhost/api/productos/prod1/restock-history?page=1&limit=1')
    const response = await GET(request, { params: { id: 'prod1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.history).toHaveLength(1)
    expect(data.pagination.currentPage).toBe(1)
    expect(data.pagination.totalPages).toBe(2)
    expect(data.pagination.hasNextPage).toBe(true)
    expect(data.pagination.hasPreviousPage).toBe(false)
  })

  it('should return 401 for unauthorized requests', async () => {
    authMock.verify_token.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/productos/prod1/restock-history')
    const response = await GET(request, { params: { id: 'prod1' } })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: "Unauthorized - Invalid or missing token"
    })
  })

  it('should return 404 for non-existent product', async () => {
    authMock.verify_token.mockResolvedValue(mockUser)
    prismaMock.producto.findUnique.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/productos/nonexistent/restock-history')
    const response = await GET(request, { params: { id: 'nonexistent' } })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: "Product not found"
    })
  })

  it('should validate query parameters', async () => {
    authMock.verify_token.mockResolvedValue(mockUser)

    const request = new NextRequest('http://localhost/api/productos/prod1/restock-history?page=0&limit=200')
    const response = await GET(request, { params: { id: 'prod1' } })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Invalid query parameters")
  })

  it('should handle sorting parameters', async () => {
    authMock.verify_token.mockResolvedValue(mockUser)
    prismaMock.producto.findUnique.mockResolvedValue(mockProduct)
    prismaMock.producto.findMany.mockResolvedValue(mockRelatedProducts)
    prismaMock.gastoCompra.findMany.mockResolvedValue(mockRestockEntries)
    prismaMock.gastoCompra.count.mockResolvedValue(2)

    const request = new NextRequest('http://localhost/api/productos/prod1/restock-history?sortBy=cantidad&sortOrder=asc')
    const response = await GET(request, { params: { id: 'prod1' } })

    expect(response.status).toBe(200)
    expect(prismaMock.gastoCompra.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { cantidad: 'asc' }
      })
    )
  })

  it('should identify different restock operation types', async () => {
    authMock.verify_token.mockResolvedValue(mockUser)
    prismaMock.producto.findUnique.mockResolvedValue(mockProduct)
    prismaMock.producto.findMany.mockResolvedValue(mockRelatedProducts)
    prismaMock.gastoCompra.findMany.mockResolvedValue(mockRestockEntries)
    prismaMock.gastoCompra.count.mockResolvedValue(2)

    const request = new NextRequest('http://localhost/api/productos/prod1/restock-history')
    const response = await GET(request, { params: { id: 'prod1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.history[0].tipoOperacion).toBe('restock_same_prices')
    expect(data.history[1].tipoOperacion).toBe('restock_new_instance')
    expect(data.history[1].productInstance).toBeDefined()
    expect(data.history[1].productInstance.id).toBe('prod2')
  })

  it('should handle database errors gracefully', async () => {
    authMock.verify_token.mockResolvedValue(mockUser)
    prismaMock.producto.findUnique.mockRejectedValue(new Error('Database connection error'))

    const request = new NextRequest('http://localhost/api/productos/prod1/restock-history')
    const response = await GET(request, { params: { id: 'prod1' } })

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe("Internal server error")
  })

  it('should return empty history for product with no restocks', async () => {
    authMock.verify_token.mockResolvedValue(mockUser)
    prismaMock.producto.findUnique.mockResolvedValue(mockProduct)
    prismaMock.producto.findMany.mockResolvedValue([mockProduct])
    prismaMock.gastoCompra.findMany.mockResolvedValue([])
    prismaMock.gastoCompra.count.mockResolvedValue(0)

    const request = new NextRequest('http://localhost/api/productos/prod1/restock-history')
    const response = await GET(request, { params: { id: 'prod1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.history).toHaveLength(0)
    expect(data.summary.totalRestocks).toBe(0)
    expect(data.summary.totalQuantityAdded).toBe(0)
    expect(data.summary.totalCostSpent).toBe(0)
  })
})
