import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  servicios: {
    findMany: vi.fn(),
    create: vi.fn(),
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

  describe('POST', () => {
    it('returns 400 when payload is invalid', async () => {
      const { POST } = await import('../route')

      const request = new NextRequest('http://localhost/api/servicios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nombre: '',
        }),
      })

      const response = await POST(request, {}, { userId: 'user-1', role: 'admin' })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Datos de entrada inválidos')
    })

    it('returns 403 for dependiente users', async () => {
      const { POST } = await import('../route')

      const request = new NextRequest('http://localhost/api/servicios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nombre: 'Servicio de prueba',
          descripcion: 'Descripcion de prueba',
          precio: 1000,
        }),
      })

      const response = await POST(request, {}, { userId: 'user-1', role: 'dependiente' })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Acceso restringido')
    })

    it('creates service with the current Prisma shape', async () => {
      const { POST } = await import('../route')

      prismaMock.servicios.create.mockResolvedValueOnce({
        servicioId: 'servicio-1',
        nombre: 'Servicio de prueba',
        descripcion: 'Descripcion de prueba',
        precio: 1000,
      })

      const request = new NextRequest('http://localhost/api/servicios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nombre: 'Servicio de prueba',
          descripcion: 'Descripcion de prueba',
          precio: 1000,
        }),
      })

      const response = await POST(request, {}, { userId: 'user-1', role: 'admin' })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.servicioId).toBe('servicio-1')
      expect(prismaMock.servicios.create).toHaveBeenCalledWith({
        data: {
          nombre: 'Servicio de prueba',
          descripcion: 'Descripcion de prueba',
          precio: 1000,
        },
      })
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
