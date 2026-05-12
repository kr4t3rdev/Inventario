import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  moneda: {
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

describe('GET /api/contabilidad/exchange/monedas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve monedas activas ordenadas', async () => {
    const prisma = (await import('@/lib/prisma')).prisma as any
    prisma.moneda.findMany.mockResolvedValue([
      { codigo: 'CUP', nombre: 'Peso Cubano', simbolo: '$', esPrincipal: true, isActive: true },
      { codigo: 'USD', nombre: 'Dólar', simbolo: '$', esPrincipal: false, isActive: true },
    ])

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/exchange/monedas')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(prisma.moneda.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { nombre: 'asc' },
      }),
    )
  })
})
