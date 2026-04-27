/**
 * Integration tests for restock API error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../route'
import { RestockErrorCode } from '../../../../../lib/restock-errors'

// Mock dependencies
vi.mock('../../../../../lib/prisma', () => ({
  prisma: {
    producto: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    gastoCompra: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}))

vi.mock('../../../../../lib/auth-middleware', () => ({
  authenticateUser: vi.fn()
}))

vi.mock('../../../../../lib/restock-utils', () => ({
  executeProductInstanceCreationWorkflow: vi.fn()
}))

vi.mock('@/lib/services/periodo-operacion-guard', () => ({
  assertOperationAllowed: vi.fn(() => Promise.resolve()),
  isPeriodoOperacionError: vi.fn(() => false),
  serializePeriodoOperacionError: vi.fn((e: Error) => ({ message: e.message })),
}))

vi.mock('@/lib/services/evento-contable-integration', () => ({
  registrarEventoContable: vi.fn(() => Promise.resolve(true)),
}))

import { prisma } from '../../../../../lib/prisma'
import { authenticateUser } from '../../../../../lib/auth-middleware'
import { executeProductInstanceCreationWorkflow } from '../../../../../lib/restock-utils'

describe('Restock API Error Handling Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createMockRequest = (body: any) => {
    return {
      json: vi.fn().mockResolvedValue(body),
      headers: new Headers(),
      method: 'POST'
    } as unknown as NextRequest
  }

  const mockUser = {
    userId: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    role: 'admin',
    isActive: true,
    expiresAt: null,
    permissions: ['restock']
  }

  const mockProduct = {
    id: 'prod-123',
    nombre: 'Test Product',
    descripcion: 'Test Description',
    precioCosto: 50,
    precioVenta: 75,
    stock: 100,
    stockMinimo: 10,
    categoriaId: 'cat-1',
    subcategoriaId: null,
    unidadId: 'unit-1',
    vendorId: 'vendor-1',
    almacenId: 'alm-1',
    puntoDeVentaId: 'pv-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    categoria: {},
    unidad: {},
    vendor: {},
    almacen: {}
  }

  describe('Authentication Errors', () => {
    it('should handle missing authentication', async () => {
      vi.mocked(authenticateUser).mockResolvedValue(
        Response.json(
          {
            success: false,
            error: {
              code: RestockErrorCode.AUTHENTICATION_FAILED,
            },
          },
          { status: 401 }
        ) as unknown as never
      )

      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: 10
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(RestockErrorCode.AUTHENTICATION_FAILED)
    })

    it('should handle invalid token', async () => {
      vi.mocked(authenticateUser).mockRejectedValue(new Error('Invalid token'))

      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: 10
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(data.success).toBe(false)
    })
  })

  describe('Validation Errors', () => {
    beforeEach(() => {
      vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never)
    })

    it('should handle invalid quantity', async () => {
      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: -5
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(RestockErrorCode.INVALID_QUANTITY)
    })

    it('should handle missing product ID', async () => {
      const request = createMockRequest({
        cantidad: 10
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(RestockErrorCode.INVALID_PRODUCT_ID)
    })

    it('should handle invalid price relationship', async () => {
      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: 10,
        precioCosto: 100,
        precioVenta: 50
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(RestockErrorCode.PRICE_RELATIONSHIP_INVALID)
    })

    it('should handle multiple validation errors', async () => {
      const request = createMockRequest({
        productoId: '',
        cantidad: -10,
        precioCosto: -50
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.errors).toBeDefined()
      expect(data.errors.length).toBeGreaterThan(1)
    })
  })

  describe('Permission Errors', () => {
    it('should handle insufficient permissions', async () => {
      const userWithoutPermissions = {
        userId: 'user-456',
        name: 'Test User 2',
        email: 'test2@example.com',
        role: 'user',
        isActive: true,
        expiresAt: null,
        permissions: ['view_products']
      }

      vi.mocked(authenticateUser).mockResolvedValue({ user: userWithoutPermissions } as never)

      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: 10
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(RestockErrorCode.INSUFFICIENT_PERMISSIONS)
    })
  })

  describe('Business Logic Errors', () => {
    beforeEach(() => {
      vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never)
    })

    it('should handle product not found', async () => {
      vi.mocked(prisma.producto.findUnique).mockResolvedValue(null)

      const request = createMockRequest({
        productoId: 'nonexistent-prod',
        cantidad: 10
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(RestockErrorCode.PRODUCT_NOT_FOUND)
    })

    it('should handle inactive product', async () => {
      const inactiveProduct = {
        ...mockProduct,
        active: false
      }

      vi.mocked(prisma.producto.findUnique).mockResolvedValue(inactiveProduct)

      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: 10
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(RestockErrorCode.PRODUCT_INACTIVE)
    })

    it('should handle stock overflow', async () => {
      const productWithMaxStock = {
        ...mockProduct,
        stock: Number.MAX_SAFE_INTEGER - 5
      }

      vi.mocked(prisma.producto.findUnique).mockResolvedValue(productWithMaxStock)

      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: 10
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(RestockErrorCode.STOCK_OVERFLOW)
    })

    it('should handle extreme price changes', async () => {
      vi.mocked(prisma.producto.findUnique).mockResolvedValue(mockProduct)

      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: 10,
        precioCosto: 5000, // 100x increase
        precioVenta: 7500
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(RestockErrorCode.CALCULATION_ERROR)
    })
  })

  describe('Database Errors', () => {
    beforeEach(() => {
      vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never)
      vi.mocked(prisma.producto.findUnique).mockResolvedValue(mockProduct)
      vi.mocked(executeProductInstanceCreationWorkflow).mockReturnValue({
        needsNewInstance: false,
        originalProductUpdate: {
          id: 'prod-123',
          newStock: 110,
          newPrecioCosto: 50,
          newPrecioVenta: 75
        },
        weightedAverages: {
          costPrice: { weightedAverage: 50, totalQuantity: 110, totalValue: 5500 },
          sellingPrice: { weightedAverage: 75, totalQuantity: 110, totalValue: 8250 }
        }
      })
    })

    it('should handle transaction failures', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error('Transaction failed'))

      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: 10
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(data.success).toBe(false)
    })

    it('should handle concurrent modifications', async () => {
      const concurrentError = new Error('Product has been modified by another operation')
      vi.mocked(prisma.$transaction).mockRejectedValue(concurrentError)

      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: 10
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(data.success).toBe(false)
    })

    it('should handle constraint violations', async () => {
      const constraintError = new Error('Unique constraint violation')
      vi.mocked(prisma.$transaction).mockRejectedValue(constraintError)

      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: 10
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(data.success).toBe(false)
    })

    it('should handle foreign key errors', async () => {
      const fkError = new Error('Foreign key constraint failed')
      vi.mocked(prisma.$transaction).mockRejectedValue(fkError)

      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: 10
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(data.success).toBe(false)
    })

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Transaction timeout exceeded')
      vi.mocked(prisma.$transaction).mockRejectedValue(timeoutError)

      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: 10
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(data.success).toBe(false)
    })
  })

  describe('Calculation Errors', () => {
    beforeEach(() => {
      vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never)
      vi.mocked(prisma.producto.findUnique).mockResolvedValue(mockProduct)
    })

    it('should handle invalid calculation results', async () => {
      vi.mocked(executeProductInstanceCreationWorkflow).mockReturnValue({
        needsNewInstance: false,
        originalProductUpdate: {
          id: 'prod-123',
          newStock: -10, // Invalid negative stock
          newPrecioCosto: 50,
          newPrecioVenta: 75
        },
        weightedAverages: {
          costPrice: { weightedAverage: 50, totalQuantity: 90, totalValue: 4500 },
          sellingPrice: { weightedAverage: 75, totalQuantity: 90, totalValue: 6750 }
        }
      })

      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: 10
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(RestockErrorCode.CALCULATION_ERROR)
    })

    it('should handle infinite calculation results', async () => {
      vi.mocked(executeProductInstanceCreationWorkflow).mockReturnValue({
        needsNewInstance: false,
        originalProductUpdate: {
          id: 'prod-123',
          newStock: 110,
          newPrecioCosto: 50,
          newPrecioVenta: 75
        },
        weightedAverages: {
          costPrice: { weightedAverage: Infinity, totalQuantity: 110, totalValue: Infinity },
          sellingPrice: { weightedAverage: 75, totalQuantity: 110, totalValue: 8250 }
        }
      })

      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: 10,
        precioCosto: 50
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(RestockErrorCode.CALCULATION_ERROR)
    })

    it('should handle NaN calculation results', async () => {
      vi.mocked(executeProductInstanceCreationWorkflow).mockReturnValue({
        needsNewInstance: false,
        originalProductUpdate: {
          id: 'prod-123',
          newStock: 110,
          newPrecioCosto: 50,
          newPrecioVenta: 75
        },
        weightedAverages: {
          costPrice: { weightedAverage: NaN, totalQuantity: 110, totalValue: NaN },
          sellingPrice: { weightedAverage: NaN, totalQuantity: 110, totalValue: NaN }
        }
      })

      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: 10,
        precioCosto: 50
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(RestockErrorCode.CALCULATION_ERROR)
    })
  })

  describe('Success Response Format', () => {
    beforeEach(() => {
      vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never)
      vi.mocked(prisma.producto.findUnique).mockResolvedValue(mockProduct)
      vi.mocked(executeProductInstanceCreationWorkflow).mockReturnValue({
        needsNewInstance: false,
        originalProductUpdate: {
          id: 'prod-123',
          newStock: 110,
          newPrecioCosto: 50,
          newPrecioVenta: 75
        },
        weightedAverages: {
          costPrice: { weightedAverage: 50, totalQuantity: 110, totalValue: 5500 },
          sellingPrice: { weightedAverage: 75, totalQuantity: 110, totalValue: 8250 }
        }
      })

      const mockUpdatedProduct = { ...mockProduct, stock: 110 }
      const mockGastoCompra = {
        id: 'gasto-123',
        productoId: 'prod-123',
        vendorId: 'vendor-1',
        cantidad: 10,
        precioUnitario: 50,
        total: 500,
        fechaCompra: new Date(),
        descripcion: 'Restock - Test Product'
      }

      vi.mocked(prisma.$transaction).mockResolvedValue({
        updatedProducto: mockUpdatedProduct,
        newProductInstance: null,
        gastoCompra: mockGastoCompra,
        workflowResult: {
          needsNewInstance: false,
          originalProductUpdate: {
            id: 'prod-123',
            newStock: 110,
            newPrecioCosto: 50,
            newPrecioVenta: 75
          },
          weightedAverages: {
            costPrice: { weightedAverage: 50, totalQuantity: 110, totalValue: 5500 },
            sellingPrice: { weightedAverage: 75, totalQuantity: 110, totalValue: 8250 }
          }
        }
      })
    })

    it('should return properly formatted success response', async () => {
      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: 10
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBeDefined()
      expect(data.data).toBeDefined()
      expect(data.data.producto).toBeDefined()
      expect(data.data.gastoCompra).toBeDefined()
      expect(data.data.restockDetails).toBeDefined()
      expect(data.data.weightedAverages).toBeDefined()
      expect(data.requestId).toBeDefined()
    })
  })

  describe('Error Response Format Consistency', () => {
    beforeEach(() => {
      vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never)
    })

    it('should have consistent error response structure', async () => {
      const request = createMockRequest({
        productoId: '',
        cantidad: -5
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('error')
      expect(data.success).toBe(false)
      expect(data.error).toHaveProperty('code')
      expect(data.error).toHaveProperty('message')
      expect(data.error).toHaveProperty('severity')
      expect(data.error).toHaveProperty('timestamp')
    })

    it('should include request ID in error responses', async () => {
      const request = createMockRequest({
        productoId: 'nonexistent',
        cantidad: 10
      })

      vi.mocked(prisma.producto.findUnique).mockResolvedValue(null)

      const response = await POST(request)
      const data = await response.json()

      expect(data.requestId).toBeDefined()
      expect(typeof data.requestId).toBe('string')
    })

    it('should include multiple errors when applicable', async () => {
      const request = createMockRequest({
        productoId: '',
        cantidad: -10,
        precioCosto: -50,
        precioVenta: -75
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.errors).toBeDefined()
      expect(Array.isArray(data.errors)).toBe(true)
      expect(data.errors.length).toBeGreaterThan(1)
    })
  })

  describe('Error Logging', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.mocked(console.error).mockRestore()
    })

    it('should log errors for debugging', async () => {
      vi.mocked(authenticateUser).mockRejectedValue(new Error('Auth failed'))

      const request = createMockRequest({
        productoId: 'prod-123',
        cantidad: 10
      })

      await POST(request)

      expect(console.error).toHaveBeenCalledWith(
        '[RESTOCK_POST]',
        expect.any(Error)
      )
    })
  })
})
