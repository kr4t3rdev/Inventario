import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  servicios: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  withAuth: (handler: any) => handler,
}))

vi.mock('@/lib/prisma', () => ({
  default: prismaMock,
  prisma: prismaMock,
}))

describe('API /servicios/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET devuelve el servicio cuando existe', async () => {
    const { GET } = await import('../route')

    prismaMock.servicios.findUnique.mockResolvedValueOnce({
      servicioId: 'serv-1',
      nombre: 'Servicio 1',
      precio: 100,
      descripcion: 'Prueba',
    })

    const request = new NextRequest('http://localhost/api/servicios/serv-1')
    const response = await GET(request, { params: Promise.resolve({ id: 'serv-1' }) })

    expect(response.status).toBe(200)
    expect(prismaMock.servicios.findUnique).toHaveBeenCalledWith({
      where: { servicioId: 'serv-1' },
    })
  })

  it('PATCH actualiza solo campos soportados por el modelo', async () => {
    const { PATCH } = await import('../route')

    prismaMock.servicios.findUnique.mockResolvedValueOnce({
      servicioId: 'serv-1',
      nombre: 'Servicio 1',
      precio: 100,
      descripcion: 'Prueba',
    })
    prismaMock.servicios.update.mockResolvedValueOnce({
      servicioId: 'serv-1',
      nombre: 'Servicio 1 editado',
      precio: 250,
      descripcion: 'Actualizado',
    })

    const request = new NextRequest('http://localhost/api/servicios/serv-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Servicio 1 editado',
        precio: 250,
      }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'serv-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.precio).toBe(250)
    expect(prismaMock.servicios.update).toHaveBeenCalledWith({
      where: { servicioId: 'serv-1' },
      data: {
        nombre: 'Servicio 1 editado',
        precio: 250,
      },
    })
  })

  it('DELETE elimina el servicio físicamente', async () => {
    const { DELETE } = await import('../route')

    prismaMock.servicios.findUnique.mockResolvedValueOnce({
      servicioId: 'serv-1',
      nombre: 'Servicio 1',
      precio: 100,
      descripcion: 'Prueba',
    })
    prismaMock.servicios.delete.mockResolvedValueOnce({
      servicioId: 'serv-1',
    })

    const request = new NextRequest('http://localhost/api/servicios/serv-1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, { params: Promise.resolve({ id: 'serv-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(prismaMock.servicios.delete).toHaveBeenCalledWith({
      where: { servicioId: 'serv-1' },
    })
  })
})