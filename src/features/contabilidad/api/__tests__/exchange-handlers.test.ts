import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  moneda: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  tasaCambio: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  transaccionMoneda: {
    create: vi.fn(),
  },
}))

const exchangeProviderMock = vi.hoisted(() => ({
  exchangeRateProvider: {
    getCurrency: vi.fn(),
    getPrincipalCurrency: vi.fn(),
    listCurrencies: vi.fn(),
    getLatestRate: vi.fn(),
    getCurrentRates: vi.fn(),
    getRateHistory: vi.fn(),
    createRate: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

vi.mock('@/features/contabilidad/services/exchange-rate-provider', () => exchangeProviderMock)

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(async () => ({
    user: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      isActive: true,
    },
  })),
}))

describe('exchange-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('converts currencies through the shared contract and persists the transaction', async () => {
    exchangeProviderMock.exchangeRateProvider.getCurrency.mockImplementation(async (codigo: string) => ({
      codigo,
      nombre: codigo,
      simbolo: codigo,
      esPrincipal: codigo === 'CUP',
      isActive: true,
    }))
    prismaMock.moneda.findUnique.mockImplementation(async ({ where }: any) => ({
      codigo: where.codigo,
      nombre: where.codigo,
      simbolo: where.codigo,
      esPrincipal: where.codigo === 'CUP',
      isActive: true,
    }))
    exchangeProviderMock.exchangeRateProvider.getLatestRate.mockResolvedValue({
      tasaId: 'rate-1',
      monedaOrigenId: 'USD',
      monedaDestino: 'CUP',
      tasa: 24.5,
      fechaVigencia: '2026-06-14T10:00:00.000Z',
    })
    prismaMock.transaccionMoneda.create.mockResolvedValue({ transaccionId: 'tx-1' })

    const { convertCurrency } = await import('@/features/contabilidad/api/exchange-handlers')
    const request = new NextRequest('http://localhost/api/exchange', {
      method: 'POST',
      body: JSON.stringify({ monto: 100, monedaOrigen: 'USD', monedaDestino: 'CUP' }),
    })
    const response = await convertCurrency(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.tasaUtilizada).toBe(24.5)
    expect(prismaMock.transaccionMoneda.create).toHaveBeenCalled()
  })

  it('returns EXCHANGE_RATE_NOT_FOUND when no rate path exists', async () => {
    exchangeProviderMock.exchangeRateProvider.getCurrency.mockImplementation(async (codigo: string) => ({
      codigo,
      nombre: codigo,
      simbolo: codigo,
      esPrincipal: false,
      isActive: true,
    }))
    prismaMock.moneda.findUnique.mockImplementation(async ({ where }: any) => ({
      codigo: where.codigo,
      nombre: where.codigo,
      simbolo: where.codigo,
      esPrincipal: false,
      isActive: true,
    }))
    exchangeProviderMock.exchangeRateProvider.getLatestRate.mockResolvedValue(null)
    exchangeProviderMock.exchangeRateProvider.getPrincipalCurrency.mockResolvedValue({
      codigo: 'CUP',
      nombre: 'Peso Cubano',
      simbolo: '$',
      esPrincipal: true,
      isActive: true,
    })

    const { convertCurrency } = await import('@/features/contabilidad/api/exchange-handlers')
    const request = new NextRequest('http://localhost/api/exchange', {
      method: 'POST',
      body: JSON.stringify({ monto: 100, monedaOrigen: 'USD', monedaDestino: 'EUR' }),
    })
    const response = await convertCurrency(request)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.code).toBe('EXCHANGE_RATE_NOT_FOUND')
    expect(prismaMock.transaccionMoneda.create).not.toHaveBeenCalled()
  })
})
