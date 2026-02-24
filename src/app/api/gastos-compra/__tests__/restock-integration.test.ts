import { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    gastoCompra: {
      findMany: jest.fn(),
    },
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('/api/gastos-compra - Restock Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
        unidad: { unidadId: 'unit2', nombre: 'Unit 2', simbolo: 'u2' },
      },
      vendor: {
        vendorId: 'vendor2',
        nombre: 'Test Vendor 2',
      },
    },
    {
      id: 'gc3',
      productoId: 'prod3',
      vendorId: 'vendor3',
      cantidad: 8,
      precioUnitario: 150,
      total: 1200,
      fechaCompra: new Date('2024-01-17'),
      descripcion: 'Restock - Test Product 3 (Nueva instancia por cambio de precios)',
      producto: {
        id: 'prod3',
        nombre: 'Test Product 3',
        categoria: { catId: 'cat3', nombre: 'Category 3' },
        unidad: { unidadId: 'unit3', nombre: 'Unit 3', simbolo: 'u3' },
      },
      vendor: {
        vendorId: 'vendor3',
        nombre: 'Test Vendor 3',
      },
    },
  ]

  describe('GET /api/gastos-compra', () => {
    it('should return all gastos compra with metadata', async () => {
      mockPrisma.gastoCompra.findMany.mockResolvedValue(mockGastosCompra)

      const request = new NextRequest('http://localhost:3000/api/gastos-compra')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(3)
      expect(data[0]).toMatchObject({
        ...mockGastosCompra[0],
        isRestock: true,
        tipoOperacion: 'restock',
      })
      expect(data[1]).toMatchObject({
        ...mockGastosCompra[1],
        isRestock: false,
        tipoOperacion: 'regular',
      })
      expect(data[2]).toMatchObject({
        ...mockGastosCompra[2],
        isRestock: true,
        tipoOperacion: 'restock',
      })
    })

    it('should filter by tipoOperacion=restock', async () => {
      const restockGastos = mockGastosCompra.filter(g => g.descripcion.includes('Restock'))
      mockPrisma.gastoCompra.findMany.mockResolvedValue(restockGastos)

      const request = new NextRequest('http://localhost:3000/api/gastos-compra?tipoOperacion=restock')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(2)
      expect(data.every((item: any) => item.isRestock)).toBe(true)
      expect(mockPrisma.gastoCompra.findMany).toHaveBeenCalledWith({
        where: {
          descripcion: { contains: 'Restock' }
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
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should filter by tipoOperacion=regular', async () => {
      const regularGastos = mockGastosCompra.filter(g => !g.descripcion.includes('Restock'))
      mockPrisma.gastoCompra.findMany.mockResolvedValue(regularGastos)

      const request = new NextRequest('http://localhost:3000/api/gastos-compra?tipoOperacion=regular')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(1)
      expect(data.every((item: any) => !item.isRestock)).toBe(true)
      expect(mockPrisma.gastoCompra.findMany).toHaveBeenCalledWith({
        where: {
          descripcion: { not: { contains: 'Restock' } }
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
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should filter by includeRestock=true', async () => {
      const restockGastos = mockGastosCompra.filter(g => g.descripcion.includes('Restock'))
      mockPrisma.gastoCompra.findMany.mockResolvedValue(restockGastos)

      const request = new NextRequest('http://localhost:3000/api/gastos-compra?includeRestock=true')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(2)
      expect(data.every((item: any) => item.isRestock)).toBe(true)
      expect(mockPrisma.gastoCompra.findMany).toHaveBeenCalledWith({
        where: {
          descripcion: { contains: 'Restock' }
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
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should filter by includeRestock=false', async () => {
      const regularGastos = mockGastosCompra.filter(g => !g.descripcion.includes('Restock'))
      mockPrisma.gastoCompra.findMany.mockResolvedValue(regularGastos)

      const request = new NextRequest('http://localhost:3000/api/gastos-compra?includeRestock=false')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(1)
      expect(data.every((item: any) => !item.isRestock)).toBe(true)
      expect(mockPrisma.gastoCompra.findMany).toHaveBeenCalledWith({
        where: {
          descripcion: { not: { contains: 'Restock' } }
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
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should filter by periodo and tipoOperacion combined', async () => {
      const filteredGastos = mockGastosCompra.filter(g => g.descripcion.includes('Restock'))
      mockPrisma.gastoCompra.findMany.mockResolvedValue(filteredGastos)

      const request = new NextRequest('http://localhost:3000/api/gastos-compra?periodo=2024-01&tipoOperacion=restock')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockPrisma.gastoCompra.findMany).toHaveBeenCalledWith({
        where: {
          periodo: '2024-01',
          descripcion: { contains: 'Restock' }
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
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should handle database errors gracefully', async () => {
      mockPrisma.gastoCompra.findMany.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/gastos-compra')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Error al obtener gastos de compra' })
    })
  })

  describe('Metadata validation', () => {
    it('should correctly identify restock entries', async () => {
      mockPrisma.gastoCompra.findMany.mockResolvedValue(mockGastosCompra)

      const request = new NextRequest('http://localhost:3000/api/gastos-compra')
      const response = await GET(request)
      const data = await response.json()

      // Check restock identification
      const restockEntry = data.find((item: any) => item.id === 'gc1')
      expect(restockEntry.isRestock).toBe(true)
      expect(restockEntry.tipoOperacion).toBe('restock')

      // Check regular entry identification
      const regularEntry = data.find((item: any) => item.id === 'gc2')
      expect(regularEntry.isRestock).toBe(false)
      expect(regularEntry.tipoOperacion).toBe('regular')

      // Check restock with price change identification
      const priceChangeEntry = data.find((item: any) => item.id === 'gc3')
      expect(priceChangeEntry.isRestock).toBe(true)
      expect(priceChangeEntry.tipoOperacion).toBe('restock')
    })
  })
})