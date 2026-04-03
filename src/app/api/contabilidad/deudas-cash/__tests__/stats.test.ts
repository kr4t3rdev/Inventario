import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    deudaCash: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    cuentaPorPagar: {
      findMany: vi.fn(),
    },
  }
}))

describe('API contabilidad/deudas-cash/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_ENABLE_DEUDAS_CASH', 'true')
  })

  it('GET devuelve 404 si módulo deshabilitado', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_DEUDAS_CASH', 'false')

    const { GET } = await import('../stats/route')
    const request = new NextRequest('http://localhost/api/contabilidad/deudas-cash/stats')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Módulo de deudas cash deshabilitado')
  })

  it('GET retorna estadísticas con estructura correcta', async () => {
    const prisma = (await import('@/lib/prisma')).default as any

    prisma.deudaCash.count
      .mockResolvedValueOnce(3)  // totalActivas (ACTIVO)
      .mockResolvedValueOnce(5)  // totalPagadas (PAGADO)
      .mockResolvedValueOnce(1)  // totalVencidas (VENCIDO)

    prisma.deudaCash.groupBy.mockResolvedValueOnce([
      { moneda: 'CUP', _sum: { montoCapital: '10000' } },
      { moneda: 'USD', _sum: { montoCapital: '500' } },
    ])

    prisma.cuentaPorPagar.findMany.mockResolvedValueOnce([
      { montoDeuda: '5000', montoPagado: '2000', deudaCash: { moneda: 'CUP' } },
      { montoDeuda: '300', montoPagado: '0', deudaCash: { moneda: 'USD' } },
    ])

    const { GET } = await import('../stats/route')
    const request = new NextRequest('http://localhost/api/contabilidad/deudas-cash/stats')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.totalActivas).toBe(3)
    expect(body.totalPagadas).toBe(5)
    expect(body.totalVencidas).toBe(1)
    expect(body.montoTotalDeuda).toEqual({ CUP: 10000, USD: 500 })
    expect(body.montoPendientePago).toEqual({ CUP: 3000, USD: 300 })
  })

  it('GET retorna stats vacías cuando no hay datos', async () => {
    const prisma = (await import('@/lib/prisma')).default as any

    prisma.deudaCash.count.mockResolvedValue(0)
    prisma.deudaCash.groupBy.mockResolvedValueOnce([])
    prisma.cuentaPorPagar.findMany.mockResolvedValueOnce([])

    const { GET } = await import('../stats/route')
    const request = new NextRequest('http://localhost/api/contabilidad/deudas-cash/stats')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.totalActivas).toBe(0)
    expect(body.totalPagadas).toBe(0)
    expect(body.totalVencidas).toBe(0)
    expect(body.montoTotalDeuda).toEqual({})
    expect(body.montoPendientePago).toEqual({})
  })

  it('GET excluye registros con deletedAt (soft delete)', async () => {
    const prisma = (await import('@/lib/prisma')).default as any

    prisma.deudaCash.count.mockResolvedValue(0)
    prisma.deudaCash.groupBy.mockResolvedValueOnce([])
    prisma.cuentaPorPagar.findMany.mockResolvedValueOnce([])

    const { GET } = await import('../stats/route')
    const request = new NextRequest('http://localhost/api/contabilidad/deudas-cash/stats')
    await GET(request)

    // Verifica que los counts aplican deletedAt: null
    expect(prisma.deudaCash.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
    )
    // Verifica que el groupBy aplica deletedAt: null
    expect(prisma.deudaCash.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
    )
  })
})
