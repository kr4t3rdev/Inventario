import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  compraServicio: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  producto: {
    update: vi.fn(),
  },
  stockUbicacion: {
    upsert: vi.fn(),
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

describe('API /compras-servicios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crea un servicio recibido y no modifica stock de productos', async () => {
    const { POST } = await import('../route')
    prismaMock.compraServicio.create.mockResolvedValueOnce({
      compraServicioId: 'cs-1',
      servicioId: 'serv-1',
      cantidad: 2,
      costoUnitario: 1500,
      total: 3000,
    })

    const request = new NextRequest('http://localhost/api/compras-servicios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        servicioId: 'serv-1',
        cantidad: 2,
        costoUnitario: 1500,
        formaPago: 'PAGO_COMPLETO',
        estado: 'PAGADA',
      }),
    })

    const response = await POST(request, {}, { userId: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.total).toBe(3000)
    expect(prismaMock.compraServicio.create).toHaveBeenCalled()
    expect(prismaMock.producto.update).not.toHaveBeenCalled()
    expect(prismaMock.stockUbicacion.upsert).not.toHaveBeenCalled()
  })

  it('lista servicios recibidos activos', async () => {
    const { GET } = await import('../route')
    prismaMock.compraServicio.findMany.mockResolvedValueOnce([
      { compraServicioId: 'cs-1' },
      { compraServicioId: 'cs-2' },
    ])

    const request = new NextRequest('http://localhost/api/compras-servicios', {
      method: 'GET',
    })

    const response = await GET(request, {}, { userId: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(2)
    expect(prismaMock.compraServicio.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
      }),
    )
  })
})
