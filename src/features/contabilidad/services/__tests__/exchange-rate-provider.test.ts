import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PrismaExchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider'

const mockPrisma = vi.hoisted(() => ({
  moneda: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  tasaCambio: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
  default: mockPrisma,
}))

describe('PrismaExchangeRateProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('selects the latest rate deterministically for a pair', async () => {
    mockPrisma.tasaCambio.findFirst.mockResolvedValue({
      tasaId: 'rate-2',
      monedaOrigenId: 'USD',
      monedaDestino: 'CUP',
      tasa: '24.75',
      fechaVigencia: new Date('2026-06-15T10:00:00.000Z'),
      createdAt: new Date('2026-06-15T10:05:00.000Z'),
    })

    const provider = new PrismaExchangeRateProvider(mockPrisma as any)
    const rate = await provider.getLatestRate('USD', 'CUP')

    expect(mockPrisma.tasaCambio.findFirst).toHaveBeenCalledWith({
      where: { monedaOrigenId: 'USD', monedaDestino: 'CUP' },
      orderBy: [
        { fechaVigencia: 'desc' },
        { createdAt: 'desc' },
        { tasaId: 'desc' },
      ],
    })
    expect(rate?.tasaId).toBe('rate-2')
    expect(rate?.tasa).toBe(24.75)
  })

  it('returns current rates ordered for the exchange dashboard', async () => {
    mockPrisma.moneda.findMany.mockResolvedValue([
      { codigo: 'CUP', nombre: 'Peso Cubano', simbolo: '$', esPrincipal: true, isActive: true },
      { codigo: 'USD', nombre: 'Dólar', simbolo: '$', esPrincipal: false, isActive: true },
    ])
    mockPrisma.tasaCambio.findMany.mockResolvedValue([
      { tasaId: 'rate-1', monedaOrigenId: 'USD', monedaDestino: 'CUP', tasa: '24.5', fechaVigencia: new Date('2026-06-14T10:00:00.000Z'), createdAt: new Date('2026-06-14T10:00:00.000Z') },
    ])

    const provider = new PrismaExchangeRateProvider(mockPrisma as any)
    const result = await provider.getCurrentRates()

    expect(result.monedaPrincipal?.codigo).toBe('CUP')
    expect(result.tasas[0]).toMatchObject({
      tasaId: 'rate-1',
      tasa: 24.5,
      ruta: 'direct',
      effectiveAt: '2026-06-14T10:00:00.000Z',
    })
  })
})
