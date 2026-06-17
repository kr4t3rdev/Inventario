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
  cuentaBancaria: { findMany: vi.fn() },
  producto: { findMany: vi.fn() },
  cuentaPorCobrar: { findMany: vi.fn() },
  inyeccionCapital: { findMany: vi.fn() },
  venta: { findMany: vi.fn() },
  ventaServicios: { findMany: vi.fn() },
  gastoCompra: { findMany: vi.fn() },
  pagosalario: { findMany: vi.fn() },
  gastosDE: { findMany: vi.fn() },
  merma: { findMany: vi.fn() },
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

describe('getBalanceFinanciero', () => {
  const baseUser = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    name: 'Admin',
    email: 'admin@example.com',
    role: 'admin',
    isActive: true,
  }

  const emptyQuery = () => [] as any[]

  // Mock que solo devuelve datos en enero (mes 1), vacío el resto del año.
  const soloEnero = (rows: any[]) =>
    vi.fn(async ({ where }: any) => {
      if (where?.createdAt?.gte instanceof Date && where.createdAt.gte.getMonth() === 0) {
        return rows
      }
      return []
    })

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.cuentaBancaria.findMany.mockImplementation(emptyQuery)
    prismaMock.producto.findMany.mockImplementation(emptyQuery)
    prismaMock.cuentaPorCobrar.findMany.mockImplementation(emptyQuery)
    prismaMock.inyeccionCapital.findMany.mockImplementation(emptyQuery)
    prismaMock.venta.findMany.mockImplementation(emptyQuery)
    prismaMock.ventaServicios.findMany.mockImplementation(emptyQuery)
    prismaMock.gastoCompra.findMany.mockImplementation(emptyQuery)
    prismaMock.pagosalario.findMany.mockImplementation(emptyQuery)
    prismaMock.gastosDE.findMany.mockImplementation(emptyQuery)
    prismaMock.merma.findMany.mockImplementation(emptyQuery)
  })

  it('incluye gastosCompras en totalGastos y en el cálculo de utilidadNeta', async () => {
    prismaMock.venta.findMany.mockImplementation(
      soloEnero([
        {
          ventaId: 'v1',
          total: 1000,
          cantidad: 10,
          producto: { precioCosto: 30, precioVenta: 100 },
        },
      ]),
    )
    prismaMock.gastoCompra.findMany.mockImplementation(soloEnero([{ gastoCompraId: 'gc1', total: 200 }]))
    prismaMock.pagosalario.findMany.mockImplementation(soloEnero([{ pgId: 's1', salario: 150, bonificaciones: 0, horasExtras: 0 }]))
    prismaMock.gastosDE.findMany.mockImplementation(soloEnero([{ gastoId: 'g1', monto: 50 }]))

    const { getBalanceFinanciero } = await import('@/features/contabilidad/api/exchange-handlers')
    const request = new NextRequest('http://localhost/api/contabilidad/balance-financiero?year=2025')
    const response = await getBalanceFinanciero(request, baseUser as any)
    const body = await response.json()

    // Enero:
    //   ingresosVentas   = 1000
    //   ventasCosto      = 30 * 10 = 300
    //   gastosCompras    = 200
    //   gastosSalarios   = 150
    //   gastosGenerales  = 50
    //   totalGastos      = 300 + 200 + 150 + 50 = 700
    //   utilidadNeta     = 1000 - 700 = 300
    expect(body.estadoResultados.anual.gastosCompras).toBe(200)
    expect(body.estadoResultados.anual.totalGastos).toBe(700)
    expect(body.estadoResultados.anual.utilidadNeta).toBe(300)
  })

  it('incluye gastosCompras en el totalGastos de cada mes', async () => {
    prismaMock.gastoCompra.findMany.mockImplementation(async () => [
      { gastoCompraId: 'gc1', total: 500 },
    ] as any[])

    const { getBalanceFinanciero } = await import('@/features/contabilidad/api/exchange-handlers')
    const request = new NextRequest('http://localhost/api/contabilidad/balance-financiero?year=2025')
    const response = await getBalanceFinanciero(request, baseUser as any)
    const body = await response.json()

    const anual = body.estadoResultados.anual
    expect(anual.gastosCompras).toBe(500 * 12)
    expect(anual.totalGastos).toBe(500 * 12)
  })

  it('expone la utilidad del ejercicio como patrimonio.utilidadEjercicio (no utilidadAcumulada)', async () => {
    prismaMock.venta.findMany.mockImplementation(
      soloEnero([
        {
          ventaId: 'v1',
          total: 1000,
          cantidad: 10,
          producto: { precioCosto: 30, precioVenta: 100 },
        },
      ]),
    )
    prismaMock.gastoCompra.findMany.mockImplementation(soloEnero([{ gastoCompraId: 'gc1', total: 200 }]))
    prismaMock.pagosalario.findMany.mockImplementation(soloEnero([{ pgId: 's1', salario: 150, bonificaciones: 0, horasExtras: 0 }]))
    prismaMock.gastosDE.findMany.mockImplementation(soloEnero([{ gastoId: 'g1', monto: 50 }]))

    const { getBalanceFinanciero } = await import('@/features/contabilidad/api/exchange-handlers')
    const request = new NextRequest('http://localhost/api/contabilidad/balance-financiero?year=2025')
    const response = await getBalanceFinanciero(request, baseUser as any)
    const body = await response.json()

    // 1000 ingresos − 700 gastos = 300 utilidad
    expect(body.balance.patrimonio.utilidadEjercicio).toBe(300)
    expect(body.balance.patrimonio).not.toHaveProperty('utilidadAcumulada')
  })
})
