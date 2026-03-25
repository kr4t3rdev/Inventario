import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../route'

vi.mock('@/lib/auth-middleware', () => ({
  withAuth: (handler: any) => async (request: NextRequest, context: any) =>
    handler(request, context, { userId: 'test-user', role: 'admin' })
}))

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn(),
    produto: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import prisma from '@/lib/prisma'
const mockPrisma = vi.mocked(prisma)

describe('Bulk Stock Minimo API - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Successful Scenarios', () => {
    it('should successfully update multiple products', async () => {
      const requestBody = {
        updates: [
          { productoId: 'prod1', stockMinimo: 10 },
          { productoId: 'prod2', stockMinimo: 15 },
          { productoId: 'prod3', stockMinimo: 0 }
        ]
      }

      // Mock transaction that succeeds for all products
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          producto: {
            findUnique: vi.fn()
              .mockResolvedValueOnce({ id: 'prod1', stockMinimo: 5, nombre: 'Producto 1' })
              .mockResolvedValueOnce({ id: 'prod2', stockMinimo: 8, nombre: 'Producto 2' })
              .mockResolvedValueOnce({ id: 'prod3', stockMinimo: 12, nombre: 'Producto 3' }),
            update: vi.fn()
              .mockResolvedValueOnce({ id: 'prod1', stockMinimo: 10 })
              .mockResolvedValueOnce({ id: 'prod2', stockMinimo: 15 })
              .mockResolvedValueOnce({ id: 'prod3', stockMinimo: 0 })
          }
        }
        return await callback(mockTx)
      })

      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.updated).toBe(3)
      expect(data.errors).toHaveLength(0)
      expect(data.results).toHaveLength(3)

      // Check individual results
      expect(data.results[0]).toEqual({
        productoId: 'prod1',
        success: true,
        previousStockMinimo: 5,
        newStockMinimo: 10
      })
      expect(data.results[1]).toEqual({
        productoId: 'prod2',
        success: true,
        previousStockMinimo: 8,
        newStockMinimo: 15
      })
      expect(data.results[2]).toEqual({
        productoId: 'prod3',
        success: true,
        previousStockMinimo: 12,
        newStockMinimo: 0
      })
    })

    it('should handle single product update', async () => {
      const requestBody = {
        updates: [
          { productoId: 'prod1', stockMinimo: 25 }
        ]
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          producto: {
            findUnique: vi.fn().mockResolvedValue({ id: 'prod1', stockMinimo: 10, nombre: 'Producto 1' }),
            update: vi.fn().mockResolvedValue({ id: 'prod1', stockMinimo: 25 })
          }
        }
        return await callback(mockTx)
      })

      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.updated).toBe(1)
      expect(data.errors).toHaveLength(0)
    })
  })

  describe('Partial Failure Scenarios', () => {
    it('should handle mixed success and failure', async () => {
      const requestBody = {
        updates: [
          { productoId: 'prod1', stockMinimo: 10 },
          { productoId: 'nonexistent', stockMinimo: 15 },
          { productoId: 'prod3', stockMinimo: 20 }
        ]
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          producto: {
            findUnique: vi.fn()
              .mockResolvedValueOnce({ id: 'prod1', stockMinimo: 5, nombre: 'Producto 1' })
              .mockResolvedValueOnce(null) // Product not found
              .mockResolvedValueOnce({ id: 'prod3', stockMinimo: 8, nombre: 'Producto 3' }),
            update: vi.fn()
              .mockResolvedValueOnce({ id: 'prod1', stockMinimo: 10 })
              .mockResolvedValueOnce({ id: 'prod3', stockMinimo: 20 })
          }
        }
        return await callback(mockTx)
      })

      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(207) // Multi-Status for partial success
      expect(data.success).toBe(false)
      expect(data.updated).toBe(2)
      expect(data.errors).toHaveLength(1)
      expect(data.results).toHaveLength(3)

      // Check error for nonexistent product
      expect(data.errors[0]).toEqual({
        productoId: 'nonexistent',
        error: 'Producto no encontrado'
      })

      // Check successful updates
      const successfulResults = data.results.filter((r: any) => r.success)
      expect(successfulResults).toHaveLength(2)
    })

    it('should handle database errors during update', async () => {
      const requestBody = {
        updates: [
          { productoId: 'prod1', stockMinimo: 10 },
          { productoId: 'prod2', stockMinimo: 15 }
        ]
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          producto: {
            findUnique: vi.fn()
              .mockResolvedValueOnce({ id: 'prod1', stockMinimo: 5, nombre: 'Producto 1' })
              .mockResolvedValueOnce({ id: 'prod2', stockMinimo: 8, nombre: 'Producto 2' }),
            update: vi.fn()
              .mockResolvedValueOnce({ id: 'prod1', stockMinimo: 10 })
              .mockRejectedValueOnce(new Error('Database constraint violation'))
          }
        }
        return await callback(mockTx)
      })

      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(207)
      expect(data.success).toBe(false)
      expect(data.updated).toBe(1)
      expect(data.errors).toHaveLength(1)
      expect(data.errors[0].error).toBe('Database constraint violation')
    })
  })

  describe('Complete Failure Scenarios', () => {
    it('should handle all products not found', async () => {
      const requestBody = {
        updates: [
          { productoId: 'nonexistent1', stockMinimo: 10 },
          { productoId: 'nonexistent2', stockMinimo: 15 }
        ]
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          producto: {
            findUnique: vi.fn()
              .mockResolvedValue(null), // All products not found
            update: vi.fn()
          }
        }
        return await callback(mockTx)
      })

      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.updated).toBe(0)
      expect(data.errors).toHaveLength(2)
      expect(data.errors.every((e: any) => e.error === 'Producto no encontrado')).toBe(true)
    })

    it('should handle transaction failure', async () => {
      const requestBody = {
        updates: [
          { productoId: 'prod1', stockMinimo: 10 }
        ]
      }

      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'))

      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.updated).toBe(0)
      expect(data.errors[0].error).toBe('Error interno del servidor')
    })
  })

  describe('Validation Scenarios', () => {
    it('should reject invalid request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: JSON.stringify(null),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.errors[0].error).toBe('El cuerpo de la petición debe ser un objeto')
    })

    it('should reject missing updates array', async () => {
      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.errors[0].error).toBe("El campo 'updates' debe ser un array")
    })

    it('should reject empty updates array', async () => {
      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: JSON.stringify({ updates: [] }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.errors[0].error).toBe("El array 'updates' no puede estar vacío")
    })

    it('should reject too many updates', async () => {
      const updates = Array(101).fill(0).map((_, i) => ({
        productoId: `prod${i}`,
        stockMinimo: 10
      }))

      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: JSON.stringify({ updates }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.errors[0].error).toBe('No se pueden actualizar más de 100 productos a la vez')
    })

    it('should reject duplicate product IDs', async () => {
      const requestBody = {
        updates: [
          { productoId: 'prod1', stockMinimo: 10 },
          { productoId: 'prod1', stockMinimo: 15 }
        ]
      }

      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.errors.some((e: any) => e.error.includes('duplicados'))).toBe(true)
    })

    it('should reject negative stock minimo values', async () => {
      const requestBody = {
        updates: [
          { productoId: 'prod1', stockMinimo: -5 }
        ]
      }

      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.errors[0].error).toContain('no puede ser negativo')
    })

    it('should reject non-integer stock minimo values', async () => {
      const requestBody = {
        updates: [
          { productoId: 'prod1', stockMinimo: 10.5 }
        ]
      }

      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.errors[0].error).toContain('debe ser un número entero')
    })

    it('should reject missing productoId', async () => {
      const requestBody = {
        updates: [
          { stockMinimo: 10 } // Missing productoId
        ]
      }

      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.errors[0].error).toContain('productoId es requerido')
    })

    it('should reject missing stockMinimo', async () => {
      const requestBody = {
        updates: [
          { productoId: 'prod1' } // Missing stockMinimo
        ]
      }

      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.errors[0].error).toContain('stockMinimo es requerido')
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero stockMinimo correctly', async () => {
      const requestBody = {
        updates: [
          { productoId: 'prod1', stockMinimo: 0 }
        ]
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          producto: {
            findUnique: vi.fn().mockResolvedValue({ id: 'prod1', stockMinimo: 10, nombre: 'Producto 1' }),
            update: vi.fn().mockResolvedValue({ id: 'prod1', stockMinimo: 0 })
          }
        }
        return await callback(mockTx)
      })

      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.results[0].newStockMinimo).toBe(0)
    })

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.errors[0].error).toBe('Error interno del servidor')
    })

    it('should handle very large stockMinimo values', async () => {
      const requestBody = {
        updates: [
          { productoId: 'prod1', stockMinimo: 999999999 }
        ]
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          producto: {
            findUnique: vi.fn().mockResolvedValue({ id: 'prod1', stockMinimo: 10, nombre: 'Producto 1' }),
            update: vi.fn().mockResolvedValue({ id: 'prod1', stockMinimo: 999999999 })
          }
        }
        return await callback(mockTx)
      })

      const request = new NextRequest('http://localhost:3000/api/productos/bulk-stock-minimo', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.results[0].newStockMinimo).toBe(999999999)
    })
  })
})
