import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  moneda: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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
  auditLog: {
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

const getCurrentUserMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: getCurrentUserMock,
}))

vi.mock('@/features/contabilidad/services/exchange-rate-provider', () => exchangeProviderMock)

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('actions-exchange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentUserMock.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      isActive: true,
    })
  })

  it('returns current exchange rates from the shared read service', async () => {
    exchangeProviderMock.exchangeRateProvider.getCurrentRates.mockResolvedValue({
      monedaPrincipal: { codigo: 'CUP', nombre: 'Peso Cubano', simbolo: '$', esPrincipal: true, isActive: true },
      tasas: [
        {
          tasaId: 'rate-1',
          monedaOrigenId: 'USD',
          monedaDestino: 'CUP',
          tasa: 24.5,
          fechaVigencia: '2026-06-14T10:00:00.000Z',
          ruta: 'direct',
          effectiveAt: '2026-06-14T10:00:00.000Z',
        },
      ],
    })

    const { getTasasActualesAction } = await import('@/features/contabilidad/actions-exchange')
    const result = await getTasasActualesAction()

    expect(result.success).toBe(true)
    expect(result.data?.tasas).toHaveLength(1)
  })

  it('persists a successful conversion with the shared quote contract', async () => {
    exchangeProviderMock.exchangeRateProvider.getCurrency.mockImplementation(async (codigo: string) => ({
      codigo,
      nombre: codigo,
      simbolo: codigo,
      esPrincipal: codigo === 'CUP',
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

    const { convertMoneyAction } = await import('@/features/contabilidad/actions-exchange')
    const result = await convertMoneyAction({ monto: 100, monedaOrigen: 'USD', monedaDestino: 'CUP', referenciaId: 'ref-1' })

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      montoOriginal: 100,
      montoConvertido: 2450,
      tasaUsada: 24.5,
      ruta: 'direct',
      referenciaId: 'ref-1',
    })
    expect(prismaMock.transaccionMoneda.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipoTransaccion: 'exchange',
          referenciaId: 'ref-1',
          monedaId: 'USD',
          tasaCambio: 24.5,
          montoConvertido: 2450,
        }),
      }),
    )
  })

  it('returns NO_MAIN_CURRENCY when a principal path is required but missing', async () => {
    exchangeProviderMock.exchangeRateProvider.getCurrency.mockImplementation(async (codigo: string) => ({
      codigo,
      nombre: codigo,
      simbolo: codigo,
      esPrincipal: false,
      isActive: true,
    }))
    exchangeProviderMock.exchangeRateProvider.getLatestRate.mockResolvedValue(null)
    exchangeProviderMock.exchangeRateProvider.getPrincipalCurrency.mockResolvedValue(null)

    const { convertMoneyAction } = await import('@/features/contabilidad/actions-exchange')
    const result = await convertMoneyAction({ monto: 100, monedaOrigen: 'USD', monedaDestino: 'EUR' })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('NO_MAIN_CURRENCY')
    expect(prismaMock.transaccionMoneda.create).not.toHaveBeenCalled()
  })

  it('avoids creating a redundant rate history row when the value is unchanged', async () => {
    prismaMock.moneda.findUnique.mockResolvedValue({
      codigo: 'USD',
      nombre: 'USD',
      simbolo: '$',
      esPrincipal: false,
      isActive: true,
    })
    exchangeProviderMock.exchangeRateProvider.getLatestRate.mockResolvedValue({
      tasaId: 'rate-1',
      monedaOrigenId: 'USD',
      monedaDestino: 'CUP',
      tasa: 24.5,
      fechaVigencia: '2026-06-14T10:00:00.000Z',
    })

    const { updateTasaCambioAction } = await import('@/features/contabilidad/actions-exchange')
    const result = await updateTasaCambioAction({ monedaOrigenId: 'USD', monedaDestino: 'CUP', tasa: 24.5 })

    expect(result.success).toBe(true)
    expect(prismaMock.tasaCambio.create).not.toHaveBeenCalled()
  })
})
