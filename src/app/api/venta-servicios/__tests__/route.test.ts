import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  ventaServicios: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
  withAuthPost: (handler: any) => handler,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

describe('API /venta-servicios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rechaza líneas de producto en endpoint de servicios', async () => {
    const { POST } = await import('../route')

    const request = new NextRequest('http://localhost/api/venta-servicios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lineas: [
          {
            tipoLinea: 'PRODUCTO',
            productoId: 'prod-1',
            cantidad: 1,
            precioUnitario: 1000,
          },
        ],
      }),
    })

    const response = await POST(request, {}, { userId: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('PRODUCT_LINE_NOT_SUPPORTED_IN_THIS_ENDPOINT')
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('crea líneas de servicio en modo mixto', async () => {
    const { POST } = await import('../route')
    prismaMock.ventaServicios.create
      .mockResolvedValueOnce({ ventaServicioId: 'vs-1' })
      .mockResolvedValueOnce({ ventaServicioId: 'vs-2' })
    prismaMock.$transaction.mockImplementationOnce(async (ops: Promise<unknown>[]) => Promise.all(ops))

    const request = new NextRequest('http://localhost/api/venta-servicios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clienteId: 'cli-1',
        lineas: [
          {
            tipoLinea: 'SERVICIO',
            servicioId: 'serv-1',
            cantidad: 1,
            precioUnitario: 2000,
          },
          {
            tipoLinea: 'SERVICIO',
            servicioId: 'serv-2',
            cantidad: 2,
            precioUnitario: 500,
          },
        ],
      }),
    })

    const response = await POST(request, {}, { userId: 'user-1' })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.mode).toBe('MIXED_LINES')
    expect(data.lineasProcesadas).toBe(2)
    expect(prismaMock.ventaServicios.create).toHaveBeenCalledTimes(2)
  })
})
