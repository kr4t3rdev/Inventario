import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { NextRequest } from 'next/server'

// Mock prisma module
vi.mock('@/lib/prisma', () => ({
  default: {
    gastosDE: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// Import after mocking
import prisma from '@/lib/prisma'
import { GET, POST } from '../route'
import { PATCH } from '../[id]/route'

describe('GastosDE API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/gastosDE', () => {
    it('should return list of gastosDE', async () => {
      const mockGastosDE = [
        { gastosDEId: '1', tipo: 'Arrendamiento', proveedor: 'Proveedor A', monto: 1000, descripcion: 'Oficina', periodo: '2026-03', numeroFactura: 'INV-001' },
        { gastosDEId: '2', tipo: 'Mantenimiento', proveedor: 'Proveedor B', monto: 500, descripcion: 'Reparación', periodo: '2026-03', numeroFactura: null },
      ]
      ;(prisma.gastosDE.findMany as Mock).mockResolvedValue(mockGastosDE)

      const request = new NextRequest('http://localhost:3000/api/gastosDE')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockGastosDE)
      expect(prisma.gastosDE.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { monto: 'desc' },
      })
    })

    it('should filter by periodo', async () => {
      const mockGastosDE = [
        { gastosDEId: '1', tipo: 'Arrendamiento', proveedor: 'Proveedor A', monto: 1000, descripcion: 'Oficina', periodo: '2026-03', numeroFactura: 'INV-001' },
      ]
      ;(prisma.gastosDE.findMany as Mock).mockResolvedValue(mockGastosDE)

      const request = new NextRequest('http://localhost:3000/api/gastosDE?periodo=2026-03')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(prisma.gastosDE.findMany).toHaveBeenCalledWith({
        where: { periodo: '2026-03' },
        orderBy: { monto: 'desc' },
      })
    })

    it('should return 500 on error', async () => {
      ;(prisma.gastosDE.findMany as Mock).mockRejectedValue(new Error('DB Error'))

      const request = new NextRequest('http://localhost:3000/api/gastosDE')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Error al obtener Gasto Derivados Empresa')
    })
  })

  describe('POST /api/gastosDE', () => {
    it('should create gastoDE with numeroFactura', async () => {
      const mockRequest = {
        gastosDEId: 'test-uuid-123',
        tipo: 'Arrendamiento',
        proveedor: 'Proveedor A',
        monto: 1000,
        descripcion: 'Oficina',
        numeroFactura: 'INV-001',
      }

      const mockCreated = {
        gastosDEId: 'test-uuid-123',
        tipo: 'Arrendamiento',
        proveedor: 'Proveedor A',
        monto: 1000,
        descripcion: 'Oficina',
        numeroFactura: 'INV-001',
        periodo: '2026-03',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      ;(prisma.gastosDE.create as Mock).mockResolvedValue(mockCreated)

      const request = new NextRequest('http://localhost:3000/api/gastosDE', {
        method: 'POST',
        body: JSON.stringify(mockRequest),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.gastosDEId).toBe(mockCreated.gastosDEId)
      expect(data.tipo).toBe(mockCreated.tipo)
      expect(data.proveedor).toBe(mockCreated.proveedor)
      expect(data.monto).toBe(mockCreated.monto)
      expect(data.descripcion).toBe(mockCreated.descripcion)
      expect(data.numeroFactura).toBe(mockCreated.numeroFactura)
      expect(data.periodo).toMatch(/^\d{4}-\d{2}$/)
      expect(prisma.gastosDE.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gastosDEId: 'test-uuid-123',
          tipo: 'Arrendamiento',
          proveedor: 'Proveedor A',
          monto: 1000,
          descripcion: 'Oficina',
          numeroFactura: 'INV-001',
          periodo: expect.stringMatching(/^\d{4}-\d{2}$/),
        }),
      })
    })

    it('should create gastoDE without numeroFactura', async () => {
      const mockRequest = {
        gastosDEId: 'test-uuid-456',
        tipo: 'Mantenimiento',
        proveedor: 'Proveedor B',
        monto: 500,
        descripcion: 'Reparación',
      }

      const mockCreated = {
        gastosDEId: 'test-uuid-456',
        tipo: 'Mantenimiento',
        proveedor: 'Proveedor B',
        monto: 500,
        descripcion: 'Reparación',
        numeroFactura: null,
        periodo: '2026-03',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      ;(prisma.gastosDE.create as Mock).mockResolvedValue(mockCreated)

      const request = new NextRequest('http://localhost:3000/api/gastosDE', {
        method: 'POST',
        body: JSON.stringify(mockRequest),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.numeroFactura).toBeNull()
      expect(data.gastosDEId).toBe(mockCreated.gastosDEId)
      expect(prisma.gastosDE.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gastosDEId: 'test-uuid-456',
          tipo: 'Mantenimiento',
          proveedor: 'Proveedor B',
          monto: 500,
          descripcion: 'Reparación',
          numeroFactura: null,
          periodo: expect.stringMatching(/^\d{4}-\d{2}$/),
        }),
      })
    })

    it('should return 500 on creation error', async () => {
      ;(prisma.gastosDE.create as Mock).mockRejectedValue(new Error('DB Error'))

      const mockRequest = {
        gastosDEId: 'test-uuid-789',
        tipo: 'Arrendamiento',
        proveedor: 'Proveedor A',
        monto: 1000,
        descripcion: 'Oficina',
      }

      const request = new NextRequest('http://localhost:3000/api/gastosDE', {
        method: 'POST',
        body: JSON.stringify(mockRequest),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Error al crear el Gasto Derivados Empresa')
    })
  })

  describe('PATCH /api/gastosDE/[id]', () => {
    it('should update gastoDE with numeroFactura', async () => {
      const mockId = 'test-uuid-123'
      const mockUpdate = {
        tipo: 'Arrendamiento Actualizado',
        numeroFactura: 'INV-999',
        proveedor: 'Proveedor A',
        monto: 1500,
        descripcion: 'Oficina Grande',
      }

      const mockUpdated = {
        gastosDEId: mockId,
        tipo: 'Arrendamiento Actualizado',
        numeroFactura: 'INV-999',
        proveedor: 'Proveedor A',
        monto: 1500,
        descripcion: 'Oficina Grande',
        periodo: '2026-03',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      ;(prisma.gastosDE.update as Mock).mockResolvedValue(mockUpdated)

      const request = new NextRequest(`http://localhost:3000/api/gastosDE/${mockId}`, {
        method: 'PATCH',
        body: JSON.stringify(mockUpdate),
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: mockId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.gastosDEId).toBe(mockUpdated.gastosDEId)
      expect(data.tipo).toBe(mockUpdated.tipo)
      expect(data.numeroFactura).toBe(mockUpdated.numeroFactura)
      expect(prisma.gastosDE.update).toHaveBeenCalledWith({
        where: { gastosDEId: mockId },
        data: expect.objectContaining({
          tipo: 'Arrendamiento Actualizado',
          numeroFactura: 'INV-999',
          proveedor: 'Proveedor A',
          monto: 1500,
          descripcion: 'Oficina Grande',
        }),
      })
    })

    it('should return 500 on update error', async () => {
      ;(prisma.gastosDE.update as Mock).mockRejectedValue(new Error('DB Error'))

      const mockId = 'test-uuid-456'
      const request = new NextRequest(`http://localhost:3000/api/gastosDE/${mockId}`, {
        method: 'PATCH',
        body: JSON.stringify({ tipo: 'Updated' }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: mockId }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Error al actualizar el Gasto Derivados Empresa')
    })
  })
})