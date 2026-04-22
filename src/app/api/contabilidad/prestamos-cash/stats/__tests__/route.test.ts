import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    prestamoCash: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    cuentaPorCobrar: {
      findMany: vi.fn(),
    },
    reconciliacionVenta: {
      aggregate: vi.fn(),
    },
  }
}))

describe('API contabilidad/prestamos-cash/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH', 'true')
  })

  it('GET retorna estadísticas enriquecidas', async () => {
    const prisma = (await import('@/lib/prisma')).default as any

    prisma.prestamoCash.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)

    prisma.prestamoCash.groupBy.mockResolvedValueOnce([
      { moneda: 'CUP', _sum: { montoCapital: '1000' } },
      { moneda: 'USD', _sum: { montoCapital: '200' } },
    ])

    prisma.cuentaPorCobrar.findMany.mockResolvedValueOnce([
      { montoDeuda: '1200', montoPagado: '500', prestamoCash: { moneda: 'CUP' } },
      { montoDeuda: '300', montoPagado: '100', prestamoCash: { moneda: 'USD' } },
    ])

    prisma.reconciliacionVenta.aggregate.mockResolvedValueOnce({
      _sum: { monto: '600' },
      _avg: { monto: '150' },
    })

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/stats')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.totalActivos).toBe(4)
    expect(body.totalPagados).toBe(2)
    expect(body.totalVencidos).toBe(1)
    expect(body.montoTotalPrestado).toEqual({ CUP: 1000, USD: 200 })
    expect(body.montoPendienteCobro).toEqual({ CUP: 700, USD: 200 })
    expect(body.resumenMovimientos.totalPagos).toBe(600)
    expect(body.resumenMovimientos.promedioPago).toBe(150)
  })
})
