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

  it('bloquea balance y resultados para el plan Básico', async () => {
    const { getBalanceFinanciero } = await import('@/features/contabilidad/api/exchange-handlers')
    const request = new NextRequest('http://localhost/api/contabilidad/balance-financiero?year=2025')
    const response = await getBalanceFinanciero(request, {
      ...baseUser,
      role: 'user',
      planName: 'Básico',
      planFeatures: { contabilidad: true, 'reportes-financieros': true },
    } as any)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBeDefined()
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

  it('calcula el costo de venta con las PurchaseAllocations FIFO (precioUnitario histórico)', async () => {
    // Venta de 10 unidades. El producto tiene precioCosto actual = 9999 (NO debe usarse).
    // Las allocations dicen: 6 unidades a 20 CUP, 4 unidades a 25 CUP.
    // Costo histórico esperado: 6*20 + 4*25 = 220.
    prismaMock.venta.findMany.mockImplementation(
      soloEnero([
        {
          ventaId: 'v1',
          total: 1000,
          cantidad: 0, // legacy, ignorado cuando hay items
          producto: { precioCosto: 9999, precioVenta: 100 },
          items: [
            {
              id: 'vi1',
              cantidad: 10,
              precioUnitario: 100,
              total: 1000,
              producto: { precioCosto: 9999 },
              allocations: [
                { id: 'a1', cantidad: 6, compraDocumentoItem: { precioUnitario: 20 } },
                { id: 'a2', cantidad: 4, compraDocumentoItem: { precioUnitario: 25 } },
              ],
            },
          ],
        },
      ]),
    )
    prismaMock.gastoCompra.findMany.mockImplementation(soloEnero([]))
    prismaMock.pagosalario.findMany.mockImplementation(soloEnero([]))
    prismaMock.gastosDE.findMany.mockImplementation(soloEnero([]))

    const { getBalanceFinanciero } = await import('@/features/contabilidad/api/exchange-handlers')
    const request = new NextRequest('http://localhost/api/contabilidad/balance-financiero?year=2025')
    const response = await getBalanceFinanciero(request, baseUser as any)
    const body = await response.json()

    const enero = body.estadoResultados.mensual.find((m: any) => m.month === 1)
    // ventasCosto debe ser 220 (FIFO), no 9999*10 (precioCosto actual)
    expect(enero.ventasCosto).toBe(220)
  })

  it('cae al precioCosto actual cuando no hay PurchaseAllocations', async () => {
    // VentaItem sin allocations: 5 unidades, producto.precioCosto = 30 → costo = 150
    prismaMock.venta.findMany.mockImplementation(
      soloEnero([
        {
          ventaId: 'v1',
          total: 500,
          cantidad: 0,
          producto: { precioCosto: 0, precioVenta: 100 },
          items: [
            {
              id: 'vi1',
              cantidad: 5,
              precioUnitario: 100,
              total: 500,
              producto: { precioCosto: 30 },
              allocations: [],
            },
          ],
        },
      ]),
    )
    prismaMock.gastoCompra.findMany.mockImplementation(soloEnero([]))
    prismaMock.pagosalario.findMany.mockImplementation(soloEnero([]))
    prismaMock.gastosDE.findMany.mockImplementation(soloEnero([]))

    const { getBalanceFinanciero } = await import('@/features/contabilidad/api/exchange-handlers')
    const request = new NextRequest('http://localhost/api/contabilidad/balance-financiero?year=2025')
    const response = await getBalanceFinanciero(request, baseUser as any)
    const body = await response.json()

    const enero = body.estadoResultados.mensual.find((m: any) => m.month === 1)
    expect(enero.ventasCosto).toBe(150)
  })

  it('calcula ingresosVentas sumando items.total en vez de usar v.total (histórico confiable)', async () => {
    // Venta con 2 items: totales 400 + 100 = 500
    // venta.total está puesto a 9999 para verificar que se ignora cuando hay items.
    prismaMock.venta.findMany.mockImplementation(
      soloEnero([
        {
          ventaId: 'v1',
          total: 9999, // debe IGNORARSE
          cantidad: 0,
          producto: { precioCosto: 0, precioVenta: 100 },
          items: [
            { id: 'i1', cantidad: 4, precioUnitario: 100, total: 400, producto: { precioCosto: 0 }, allocations: [] },
            { id: 'i2', cantidad: 1, precioUnitario: 100, total: 100, producto: { precioCosto: 0 }, allocations: [] },
          ],
        },
      ]),
    )
    prismaMock.gastoCompra.findMany.mockImplementation(soloEnero([]))
    prismaMock.pagosalario.findMany.mockImplementation(soloEnero([]))
    prismaMock.gastosDE.findMany.mockImplementation(soloEnero([]))

    const { getBalanceFinanciero } = await import('@/features/contabilidad/api/exchange-handlers')
    const request = new NextRequest('http://localhost/api/contabilidad/balance-financiero?year=2025')
    const response = await getBalanceFinanciero(request, baseUser as any)
    const body = await response.json()

    const enero = body.estadoResultados.mensual.find((m: any) => m.month === 1)
    expect(enero.ingresosVentas).toBe(500) // sum(items.total), NO 9999
  })

  it('NO distorsiona ingresos con precioVenta actual cuando v.total es null y no hay items', async () => {
    // Venta legacy con total=null, cantidad=10, producto.precioVenta=100
    // Comportamiento ANTERIOR (buggy): 10 * 100 = 1000
    // Comportamiento NUEVO: 0 (mejor sub-registrar que inventar)
    prismaMock.venta.findMany.mockImplementation(
      soloEnero([
        {
          ventaId: 'v1',
          total: null, // dato faltante
          cantidad: 10,
          producto: { precioCosto: 0, precioVenta: 100 },
          items: [],
        },
      ]),
    )
    prismaMock.gastoCompra.findMany.mockImplementation(soloEnero([]))
    prismaMock.pagosalario.findMany.mockImplementation(soloEnero([]))
    prismaMock.gastosDE.findMany.mockImplementation(soloEnero([]))

    const { getBalanceFinanciero } = await import('@/features/contabilidad/api/exchange-handlers')
    const request = new NextRequest('http://localhost/api/contabilidad/balance-financiero?year=2025')
    const response = await getBalanceFinanciero(request, baseUser as any)
    const body = await response.json()

    const enero = body.estadoResultados.mensual.find((m: any) => m.month === 1)
    expect(enero.ingresosVentas).toBe(0) // NO 1000 (que era el bug)
  })
})
