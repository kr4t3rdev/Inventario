import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectActionFailure, expectActionSuccess } from "@/test/action-response";

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
const provisionPolicyMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

vi.mock('@/features/contabilidad/services/tenant-accounting-policy-service', () => {
  class TenantAccountingPolicyError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly auditResult?: unknown,
    ) {
      super(message)
      this.name = 'TenantAccountingPolicyError'
    }
  }
  return {
    provisionTenantAccountingPolicy: provisionPolicyMock,
    TenantAccountingPolicyError,
  }
})

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
    expect(expectActionSuccess(result).data?.tasas).toHaveLength(1)
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
    expect(expectActionSuccess(result).data).toMatchObject({
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
    expect(expectActionFailure(result).error?.code).toBe('NO_MAIN_CURRENCY')
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

  describe('cambiarMonedaPrincipalAction', () => {
    const empresarialUser = {
      userId: 'user-1',
      tenantId: 'tenant-1',
      name: 'Empresa',
      email: 'empresa@example.com',
      role: 'regularUser',
      isActive: true,
      planFeatures: { 'multi-moneda': true, 'moneda-principal-cambio': true },
    }

    it('rechaza a planes sin el feature de cambio de moneda principal', async () => {
      getCurrentUserMock.mockResolvedValue({
        ...empresarialUser,
        planFeatures: { 'multi-moneda': true },
      })

      const { cambiarMonedaPrincipalAction } = await import(
        '@/features/contabilidad/actions-exchange'
      )
      const result = await cambiarMonedaPrincipalAction({ codigo: 'USD' })

      expect(result.success).toBe(false)
      expect(expectActionFailure(result).error?.code).toBe('FEATURE_NOT_AVAILABLE')
      expect(provisionPolicyMock).not.toHaveBeenCalled()
      expect(prismaMock.moneda.findUnique).not.toHaveBeenCalled()
    })

    it('cambia la moneda principal cuando el plan lo permite y no hay movimientos', async () => {
      getCurrentUserMock.mockResolvedValue(empresarialUser)
      prismaMock.moneda.findUnique.mockResolvedValue({
        codigo: 'USD',
        nombre: 'Dólar estadounidense',
        simbolo: 'US$',
        isActive: true,
      })
      provisionPolicyMock.mockResolvedValue({
        result: 'UPDATED',
        functionalCurrencyCode: 'USD',
        existingCurrencyCode: 'CUP',
        evidence: 'NONE',
      })

      const { cambiarMonedaPrincipalAction } = await import(
        '@/features/contabilidad/actions-exchange'
      )
      const result = await cambiarMonedaPrincipalAction({ codigo: 'usd' })

      expect(result.success).toBe(true)
      expect(prismaMock.moneda.findUnique).toHaveBeenCalledWith({
        where: { codigo: 'USD' },
      })
      expect(provisionPolicyMock).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 'tenant-1',
        functionalCurrencyCode: 'USD',
        actorUserId: 'user-1',
        origin: 'TENANT_UI',
      }))
    })

    it('no falla si la moneda solicitada ya es la principal', async () => {
      getCurrentUserMock.mockResolvedValue(empresarialUser)
      prismaMock.moneda.findUnique.mockResolvedValue({
        codigo: 'CUP',
        nombre: 'Peso cubano',
        simbolo: '$',
        isActive: true,
      })
      provisionPolicyMock.mockResolvedValue({
        result: 'NO_OP',
        functionalCurrencyCode: 'CUP',
        existingCurrencyCode: 'CUP',
        evidence: 'NONE',
      })

      const { cambiarMonedaPrincipalAction } = await import(
        '@/features/contabilidad/actions-exchange'
      )
      const result = await cambiarMonedaPrincipalAction({ codigo: 'CUP' })

      expect(result.success).toBe(true)
      expect(provisionPolicyMock).toHaveBeenCalled()
    })

    it('bloquea el cambio cuando la empresa ya tiene movimientos contables', async () => {
      getCurrentUserMock.mockResolvedValue(empresarialUser)
      prismaMock.moneda.findUnique.mockResolvedValue({
        codigo: 'USD',
        nombre: 'Dólar estadounidense',
        simbolo: 'US$',
        isActive: true,
      })
      const { TenantAccountingPolicyError } = await import(
        '@/features/contabilidad/services/tenant-accounting-policy-service'
      )
      provisionPolicyMock.mockRejectedValue(
        new TenantAccountingPolicyError(
          'La moneda funcional no puede cambiar después de registrar evidencia contable',
          'FUNCTIONAL_CURRENCY_IMMUTABLE',
        ),
      )

      const { cambiarMonedaPrincipalAction } = await import(
        '@/features/contabilidad/actions-exchange'
      )
      const result = await cambiarMonedaPrincipalAction({ codigo: 'USD' })

      expect(result.success).toBe(false)
      expect(expectActionFailure(result).error?.code).toBe('FUNCTIONAL_CURRENCY_IMMUTABLE')
    })

    it('no abre un proceso de revisión cuando la evidencia requiere revisión', async () => {
      getCurrentUserMock.mockResolvedValue(empresarialUser)
      prismaMock.moneda.findUnique.mockResolvedValue({
        codigo: 'USD',
        nombre: 'Dólar estadounidense',
        simbolo: 'US$',
        isActive: true,
      })
      provisionPolicyMock.mockResolvedValue({
        result: 'CONFLICT',
        functionalCurrencyCode: 'USD',
        existingCurrencyCode: 'CUP',
        evidence: 'REVIEW_REQUIRED',
      })

      const { cambiarMonedaPrincipalAction } = await import(
        '@/features/contabilidad/actions-exchange'
      )
      const result = await cambiarMonedaPrincipalAction({ codigo: 'USD' })

      expect(result.success).toBe(false)
      expect(expectActionFailure(result).error?.code).toBe('ACCOUNTING_POLICY_BLOCKED')
      expect(result).toMatchObject({
        error: { message: expect.stringContaining('movimientos contables') },
      })
    })

    it('rechaza monedas inexistentes o inactivas del catálogo', async () => {
      getCurrentUserMock.mockResolvedValue(empresarialUser)
      prismaMock.moneda.findUnique.mockResolvedValue(null)

      const { cambiarMonedaPrincipalAction } = await import(
        '@/features/contabilidad/actions-exchange'
      )
      const result = await cambiarMonedaPrincipalAction({ codigo: 'XYZ' })

      expect(result.success).toBe(false)
      expect(expectActionFailure(result).error?.code).toBe('FUNCTIONAL_CURRENCY_NOT_AVAILABLE')
      expect(provisionPolicyMock).not.toHaveBeenCalled()
    })
  })
})
