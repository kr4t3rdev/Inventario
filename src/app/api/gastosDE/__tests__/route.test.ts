import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { NextRequest } from 'next/server'

// Mock authenticateUser
vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn().mockResolvedValue({ user: { userId: 'test-user', name: 'Test', email: 'test@test.com', role: 'ADMIN', isActive: true } }),
}))

// Mock prisma module
vi.mock('@/lib/prisma', () => ({
  default: {
    gastosDE: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

const assertOperationAllowedMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/services/periodo-operacion-guard', () => ({
  assertOperationAllowed: assertOperationAllowedMock,
  isPeriodoOperacionError: (error: unknown) =>
    Boolean(
      error &&
        typeof error === 'object' &&
        'code' in (error as Record<string, unknown>) &&
        (error as Record<string, unknown>).code === 'PERIODO_BLOQUEADO'
    ),
  serializePeriodoOperacionError: (error: { message: string; code: string }) => ({
    error: error.message,
    code: error.code,
  }),
}))

// Import after mocking
import prisma from '@/lib/prisma'
import { GET, POST } from '../route'
import { GET as GET_BY_ID, PATCH, DELETE } from '../[id]/route'

describe('GastosDE API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/gastosDE', () => {
    it('should return list of gastosDE', async () => {
      const mockGastosDE = [
        { gastosDEId: '1', tipo: 'Arrendamiento', conceptoId: null, elementoId: null, proveedor: 'Proveedor A', monto: 1000, descripcion: 'Oficina', periodo: '2026-03', numeroFactura: 'INV-001', isPagado: 'pendiente' },
        { gastosDEId: '2', tipo: 'Mantenimiento', conceptoId: null, elementoId: null, proveedor: 'Proveedor B', monto: 500, descripcion: 'Reparación', periodo: '2026-03', numeroFactura: null, isPagado: 'pendiente' },
      ]
      ;(prisma.gastosDE.findMany as Mock).mockResolvedValue(mockGastosDE)

      const request = new NextRequest('http://localhost:3000/api/gastosDE')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockGastosDE)
      expect(prisma.gastosDE.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          concepto: true,
          elemento: true,
        },
        orderBy: { monto: 'desc' },
      })
    })

    it('should filter by periodo', async () => {
      const mockGastosDE = [
        { gastosDEId: '1', tipo: 'Arrendamiento', conceptoId: null, elementoId: null, proveedor: 'Proveedor A', monto: 1000, descripcion: 'Oficina', periodo: '2026-03', numeroFactura: 'INV-001', isPagado: 'pendiente' },
      ]
      ;(prisma.gastosDE.findMany as Mock).mockResolvedValue(mockGastosDE)

      const request = new NextRequest('http://localhost:3000/api/gastosDE?periodo=2026-03')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(prisma.gastosDE.findMany).toHaveBeenCalledWith({
        where: { periodo: '2026-03' },
        include: {
          concepto: true,
          elemento: true,
        },
        orderBy: { monto: 'desc' },
      })
    })

    it('should return 401 when not authenticated', async () => {
      const { authenticateUser } = await import('@/lib/auth-middleware')
      ;(authenticateUser as Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Token no proporcionado' }), { status: 401 })
      )

      const request = new NextRequest('http://localhost:3000/api/gastosDE')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Token no proporcionado')
    })

    it('should return 500 on error', async () => {
      ;(prisma.gastosDE.findMany as Mock).mockRejectedValue(new Error('DB Error'))

      const request = new NextRequest('http://localhost:3000/api/gastosDE')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Error al obtener Gastos de Explotación')
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
        isPagado: 'pendiente',
      }
      ;(prisma.gastosDE.create as Mock).mockResolvedValue(mockCreated)

      const request = new NextRequest('http://localhost:3000/api/gastosDE', {
        method: 'POST',
        body: JSON.stringify(mockRequest),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
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
          conceptoId: null,
          elementoId: null,
          proveedor: 'Proveedor A',
          monto: 1000,
          descripcion: 'Oficina',
          numeroFactura: 'INV-001',
          periodo: expect.stringMatching(/^\d{4}-\d{2}$/),
        }),
        include: {
          concepto: true,
          elemento: true,
        },
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
        isPagado: 'pendiente',
      }
      ;(prisma.gastosDE.create as Mock).mockResolvedValue(mockCreated)

      const request = new NextRequest('http://localhost:3000/api/gastosDE', {
        method: 'POST',
        body: JSON.stringify(mockRequest),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.numeroFactura).toBeNull()
      expect(data.gastosDEId).toBe(mockCreated.gastosDEId)
      expect(prisma.gastosDE.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gastosDEId: 'test-uuid-456',
          tipo: 'Mantenimiento',
          conceptoId: null,
          elementoId: null,
          proveedor: 'Proveedor B',
          monto: 500,
          descripcion: 'Reparación',
          numeroFactura: null,
          periodo: expect.stringMatching(/^\d{4}-\d{2}$/),
        }),
        include: {
          concepto: true,
          elemento: true,
        },
      })
    })

    it('should return 400 when monto is negative', async () => {
      const mockRequest = {
        gastosDEId: 'test-uuid-789',
        tipo: 'Arrendamiento',
        proveedor: 'Proveedor A',
        monto: -100,
        descripcion: 'Oficina',
      }

      const request = new NextRequest('http://localhost:3000/api/gastosDE', {
        method: 'POST',
        body: JSON.stringify(mockRequest),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('El monto debe ser mayor a 0')
    })

    it('should return 400 when proveedor is missing', async () => {
      const mockRequest = {
        gastosDEId: 'test-uuid-789',
        tipo: 'Arrendamiento',
        conceptoId: null,
        elementoId: null,
        monto: 100,
        descripcion: 'Oficina',
      }

      const request = new NextRequest('http://localhost:3000/api/gastosDE', {
        method: 'POST',
        body: JSON.stringify(mockRequest),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })

    it('should return 500 on creation error', async () => {
      ;(prisma.gastosDE.create as Mock).mockRejectedValue(new Error('DB Error'))

      const mockRequest = {
        gastosDEId: 'test-uuid-789',
        tipo: 'Arrendamiento',
        conceptoId: null,
        elementoId: null,
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
      expect(data.error).toBe('Error al crear el Gasto de Explotación')
    })
  })

  describe('GET /api/gastosDE/[id]', () => {
    it('should return single gastoDE by id', async () => {
      const mockGasto = {
        gastosDEId: '1',
        tipo: 'Arrendamiento',
        conceptoId: null,
        elementoId: null,
        proveedor: 'Proveedor A',
        monto: 1000,
        descripcion: 'Oficina',
        periodo: '2026-03',
        numeroFactura: 'INV-001',
        isPagado: 'pendiente',
      }
      ;(prisma.gastosDE.findUnique as Mock).mockResolvedValue(mockGasto)

      const request = new NextRequest('http://localhost:3000/api/gastosDE/1')
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: '1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.gastosDEId).toBe('1')
    })

    it('should return 404 when not found', async () => {
      ;(prisma.gastosDE.findUnique as Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/gastosDE/nonexistent')
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: 'nonexistent' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Gasto de Explotación no encontrado')
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
        isPagado: 'pendiente',
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
        include: {
          concepto: true,
          elemento: true,
        },
      })
    })

    it('should return 400 when monto is negative', async () => {
      const mockId = 'test-uuid-456'
      const request = new NextRequest(`http://localhost:3000/api/gastosDE/${mockId}`, {
        method: 'PATCH',
        body: JSON.stringify({ monto: -50 }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: mockId }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('El monto debe ser mayor a 0')
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
      expect(data.error).toBe('Error al actualizar el Gasto de Explotación')
    })
  })

  describe('DELETE /api/gastosDE/[id]', () => {
    it('should delete gastoDE without reconciliaciones', async () => {
      const mockId = 'test-uuid-123'
      ;(prisma.gastosDE.findUnique as Mock).mockResolvedValue({
        gastosDEId: mockId,
        reconciliaciones: [],
      })
      ;(prisma.gastosDE.delete as Mock).mockResolvedValue({})

      const request = new NextRequest(`http://localhost:3000/api/gastosDE/${mockId}`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: mockId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return 400 when gasto has reconciliaciones', async () => {
      const mockId = 'test-uuid-456'
      ;(prisma.gastosDE.findUnique as Mock).mockResolvedValue({
        gastosDEId: mockId,
        reconciliaciones: [{ reconciliacionId: 'rec-1' }],
      })

      const request = new NextRequest(`http://localhost:3000/api/gastosDE/${mockId}`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: mockId }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No se puede eliminar un gasto que tiene reconciliaciones asociadas')
    })

    it('should return 404 when gasto not found', async () => {
      ;(prisma.gastosDE.findUnique as Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/gastosDE/nonexistent', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'nonexistent' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Gasto de Explotación no encontrado')
    })
  })

  describe('POST - bloqueo por período contable', () => {
    it('debe responder 409 cuando el período está bloqueado', async () => {
      const { assertOperationAllowed } = await import('@/lib/services/periodo-operacion-guard')
      const mockFn = assertOperationAllowed as unknown as Mock
      mockFn.mockRejectedValueOnce({
        message: 'Período cerrado',
        status: 409,
        code: 'PERIODO_BLOQUEADO',
      })

      const request = new NextRequest('http://localhost:3000/api/gastosDE', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          proveedor: 'Test Proveedor',
          monto: 100,
          descripcion: 'Test gasto',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.code).toBe('PERIODO_BLOQUEADO')
    })
  })
})
