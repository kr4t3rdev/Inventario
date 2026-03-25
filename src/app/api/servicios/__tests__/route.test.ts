import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  servicios: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  vendor: {
    findUnique: vi.fn(),
  },
  categoria: {
    findUnique: vi.fn(),
  },
  unidad: {
    findUnique: vi.fn(),
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

describe('API /servicios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST - FK Validation', () => {
    it('returns 400 when vendorId does not exist', async () => {
      const { POST } = await import('../route')

      prismaMock.vendor.findUnique.mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost/api/servicios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nombre: 'Servicio de prueba',
          vendorId: 'vendor-inexistente',
        }),
      })

      const response = await POST(request, {}, { userId: 'user-1', role: 'admin' })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('El proveedor especificado no existe')
      expect(data.field).toBe('proveedor')
    })

    it('returns 400 when categoriaId does not exist', async () => {
      const { POST } = await import('../route')

      prismaMock.categoria.findUnique.mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost/api/servicios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nombre: 'Servicio de prueba',
          categoriaId: 'categoria-inexistente',
        }),
      })

      const response = await POST(request, {}, { userId: 'user-1', role: 'admin' })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('La categoría especificada no existe')
      expect(data.field).toBe('categoría')
    })

    it('returns 400 when unidadId does not exist', async () => {
      const { POST } = await import('../route')

      prismaMock.unidad.findUnique.mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost/api/servicios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nombre: 'Servicio de prueba',
          unidadId: 'unidad-inexistente',
        }),
      })

      const response = await POST(request, {}, { userId: 'user-1', role: 'admin' })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('La unidad especificada no existe')
      expect(data.field).toBe('unidad')
    })

    it('creates service when all FKs are valid', async () => {
      const { POST } = await import('../route')

      prismaMock.servicios.create.mockResolvedValueOnce({
        servicioId: 'servicio-1',
        nombre: 'Servicio de prueba',
      })

      const request = new NextRequest('http://localhost/api/servicios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nombre: 'Servicio de prueba',
          precio: 1000,
        }),
      })

      const response = await POST(request, {}, { userId: 'user-1', role: 'admin' })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.servicioId).toBe('servicio-1')
    })

    it('creates service when FKs are null', async () => {
      const { POST } = await import('../route')

      prismaMock.servicios.create.mockResolvedValueOnce({
        servicioId: 'servicio-1',
        nombre: 'Servicio de prueba',
      })

      const request = new NextRequest('http://localhost/api/servicios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nombre: 'Servicio de prueba',
          vendorId: null,
          categoriaId: null,
          unidadId: null,
        }),
      })

      const response = await POST(request, {}, { userId: 'user-1', role: 'admin' })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(prismaMock.vendor.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('GET', () => {
    it('returns servicios list', async () => {
      const { GET } = await import('../route')

      prismaMock.servicios.findMany.mockResolvedValueOnce([
        { servicioId: 's1', nombre: 'Servicio 1' },
      ])

      const request = new NextRequest('http://localhost/api/servicios')
      const response = await GET(request, {}, { userId: 'user-1' })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(1)
    })
  })
})
