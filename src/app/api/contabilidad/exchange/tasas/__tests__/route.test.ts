import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  moneda: {
    findMany: vi.fn(),
  },
  tasaCambio: {
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

describe('GET /api/contabilidad/exchange/tasas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve moneda principal y tasas actuales', async () => {
    const prisma = (await import('@/lib/prisma')).prisma as any
    prisma.moneda.findMany.mockResolvedValue([
      { codigo: 'CUP', nombre: 'Peso Cubano', simbolo: '$', esPrincipal: true },
      { codigo: 'USD', nombre: 'Dólar', simbolo: '$', esPrincipal: false },
    ])
    prisma.tasaCambio.findMany.mockResolvedValue([
      { tasaId: 't1', monedaOrigenId: 'USD', monedaDestino: 'CUP', tasa: '24', fechaVigencia: new Date('2026-01-01') },
    ])

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/exchange/tasas')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.monedaPrincipal.codigo).toBe('CUP')
    expect(body.data.tasas).toHaveLength(1)
  })
})
