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
  stockUbicacion: { findMany: vi.fn() },
  cuentaPorCobrar: { findMany: vi.fn() },
  inyeccionCapital: { findMany: vi.fn() },
  venta: { findMany: vi.fn() },
  ventaServicios: { findMany: vi.fn() },
  compraServicio: { findMany: vi.fn() },
  gastoCompra: { findMany: vi.fn() },
  pagosalario: { findMany: vi.fn() },
  gastosDE: { findMany: vi.fn() },
  merma: { findMany: vi.fn() },
  reconciliacionVenta: { findMany: vi.fn() },
  reconciliacionServicio: { findMany: vi.fn() },
  reconciliacionGasto: { findMany: vi.fn() },
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
  const currentPeriodRows = (rows: any[]) => async ({ where }: any) => {
    return where?.fechaReconciliacion?.gte ? rows : []
  }

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.cuentaBancaria.findMany.mockImplementation(emptyQuery)
    prismaMock.producto.findMany.mockImplementation(emptyQuery)
    prismaMock.stockUbicacion.findMany.mockImplementation(emptyQuery)
    prismaMock.cuentaPorCobrar.findMany.mockImplementation(emptyQuery)
    prismaMock.inyeccionCapital.findMany.mockImplementation(emptyQuery)
    prismaMock.venta.findMany.mockImplementation(emptyQuery)
    prismaMock.ventaServicios.findMany.mockImplementation(emptyQuery)
    prismaMock.compraServicio.findMany.mockImplementation(emptyQuery)
    prismaMock.gastoCompra.findMany.mockImplementation(emptyQuery)
    prismaMock.pagosalario.findMany.mockImplementation(emptyQuery)
    prismaMock.gastosDE.findMany.mockImplementation(emptyQuery)
    prismaMock.merma.findMany.mockImplementation(emptyQuery)
    prismaMock.reconciliacionVenta.findMany.mockImplementation(emptyQuery)
    prismaMock.reconciliacionServicio.findMany.mockImplementation(emptyQuery)
    prismaMock.reconciliacionGasto.findMany.mockImplementation(emptyQuery)
    exchangeProviderMock.exchangeRateProvider.getPrincipalCurrency.mockResolvedValue({
      codigo: 'CUP',
      nombre: 'Peso Cubano',
      simbolo: '$',
      esPrincipal: true,
      isActive: true,
    })
  })

  it('permite balance y resultados para el plan Básico cuando contabilidad está habilitada', async () => {
    const { getBalanceFinanciero } = await import('@/features/contabilidad/api/exchange-handlers')
    const request = new NextRequest('http://localhost/api/contabilidad/balance-financiero?year=2025')
    const response = await getBalanceFinanciero(request, {
      ...baseUser,
      role: 'user',
      planName: 'Básico',
      planFeatures: { contabilidad: true, 'reportes-financieros': false },
    } as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.balance).toBeDefined()
    expect(body.estadoResultados).toBeDefined()
  })

  it('rechaza administradores sin una empresa seleccionada', async () => {
    const { getBalanceFinanciero } = await import('@/features/contabilidad/api/exchange-handlers')
    const request = new NextRequest('http://localhost/api/contabilidad/balance-financiero?year=2025')
    const response = await getBalanceFinanciero(request, {
      ...baseUser,
      tenantId: undefined,
    } as any)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('Selecciona una empresa para consultar el reporte')
    expect(prismaMock.cuentaBancaria.findMany).not.toHaveBeenCalled()
  })

  it('consulta reconciliaciones una vez por fuente con un rango anual semiabierto', async () => {
    const { getBalanceFinanciero } = await import('@/features/contabilidad/api/exchange-handlers')
    const request = new NextRequest('http://localhost/api/contabilidad/balance-financiero?year=2025')
    const response = await getBalanceFinanciero(request, baseUser as any)

    expect(response.status).toBe(200)
    expect(prismaMock.reconciliacionVenta.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.reconciliacionServicio.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.reconciliacionGasto.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.merma.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.reconciliacionVenta.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: 'tenant-1',
      fechaReconciliacion: {
        gte: new Date('2025-01-01T05:00:00.000Z'),
        lt: new Date('2026-01-01T05:00:00.000Z'),
      },
    })
    expect(prismaMock.venta.findMany).not.toHaveBeenCalled()
    expect(prismaMock.gastoCompra.findMany).not.toHaveBeenCalled()
  })

  it('calcula resultado y flujo desde dinero reconciliado sin doble conteo', async () => {
    prismaMock.reconciliacionVenta.findMany.mockImplementation(currentPeriodRows([
      {
        reconciliacionId: 'rv-sale',
        monto: 500,
        moneda: 'CUP',
        montoConvertido: null,
        tasaCambio: null,
        fechaReconciliacion: new Date('2025-01-10T12:00:00Z'),
        tipoReconciliacion: null,
        venta: {
          ventaId: 'sale-1',
          total: 1000,
          cantidad: 0,
          producto: { precioCosto: 0 },
          items: [{
            id: 'item-1',
            cantidad: 10,
            total: 1000,
            producto: { precioCosto: 999 },
            allocations: [
              { id: 'a1', cantidad: 6, compraDocumentoItem: { precioUnitario: 20 } },
              { id: 'a2', cantidad: 4, compraDocumentoItem: { precioUnitario: 25 } },
            ],
          }],
        },
      },
      {
        reconciliacionId: 'rv-loan',
        monto: 200,
        moneda: 'CUP',
        montoConvertido: null,
        tasaCambio: null,
        fechaReconciliacion: new Date('2025-01-11T12:00:00Z'),
        tipoReconciliacion: 'PRESTAMO_CASH',
        venta: null,
      },
    ]))
    prismaMock.reconciliacionServicio.findMany.mockImplementation(currentPeriodRows([{
      reconciliacionId: 'rs-service',
      monto: 500,
      moneda: 'CUP',
      montoConvertido: null,
      tasaCambio: null,
      fechaReconciliacion: new Date('2025-01-12T12:00:00Z'),
      ventasServicio: {
        ventaServicioId: 'service-1',
        total: 500,
        costo: 30,
        cantidad: 4,
      },
    }]))
    prismaMock.reconciliacionGasto.findMany.mockImplementation(currentPeriodRows([
      {
        reconciliacionId: 'rg-purchase', tipoGasto: 'compra', referenciaId: 'purchase-1',
        monto: 300, moneda: 'CUP', montoConvertido: null, tasaCambio: null,
        fechaReconciliacion: new Date('2025-01-13T12:00:00Z'), estado: 'PAGADA',
        gastoCompra: { total: 300 }, gastoDE: null, pagoSalario: null,
      },
      {
        reconciliacionId: 'rg-salary', tipoGasto: 'salario', referenciaId: 'salary-1',
        monto: 650, moneda: 'CUP', montoConvertido: null, tasaCambio: null,
        fechaReconciliacion: new Date('2025-01-14T12:00:00Z'), estado: 'PAGADA',
        gastoCompra: null, gastoDE: null,
        pagoSalario: { salario: 500, bonificaciones: 100, horasExtras: 50 },
      },
      {
        reconciliacionId: 'rg-service-cost', tipoGasto: 'venta_servicio',
        referenciaId: 'service-1', monto: 120, moneda: 'CUP', montoConvertido: null,
        tasaCambio: null, fechaReconciliacion: new Date('2025-01-15T12:00:00Z'),
        estado: 'PAGADA', gastoCompra: null, gastoDE: null, pagoSalario: null,
      },
    ]))
    prismaMock.merma.findMany.mockResolvedValue([{
      mermaId: 'loss-1',
      costoTotal: 90,
      createdAt: new Date('2025-01-16T12:00:00Z'),
    }])

    const { getBalanceFinanciero } = await import('@/features/contabilidad/api/exchange-handlers')
    const request = new NextRequest('http://localhost/api/contabilidad/balance-financiero?year=2025')
    const response = await getBalanceFinanciero(request, baseUser as any)
    const body = await response.json()
    const annual = body.estadoResultados.anual

    expect(annual.income).toEqual({ sales: 500, services: 500, total: 1000 })
    expect(annual.costOfSales.total).toBe(230)
    expect(annual.operatingExpenses.salaries).toBe(650)
    expect(annual.inventoryPurchases).toBe(300)
    expect(annual.nonCashAdjustments.shrinkages).toBe(90)
    expect(annual.reconciledResult).toBe(120)
    expect(annual.cashFlow).toEqual({ operating: -70, financial: 200, net: 130 })
    expect(annual.totalGastos).toBe(880)
    expect(annual.gastosCompras).toBe(300)
    expect(annual.gastosMermas).toBe(90)
    expect(annual.utilidadNeta).toBe(120)
    expect(body.balance.patrimonio.utilidadEjercicio).toBe(120)
  })

  it('respeta saldo previo, descuento neto y ventas eliminadas', async () => {
    const activeSale = {
      ventaId: 'discounted-sale',
      total: null,
      descuento: 100,
      cantidad: 0,
      deletedAt: null,
      producto: { precioCosto: 0 },
      items: [{
        id: 'item-1',
        cantidad: 10,
        total: 1000,
        producto: { precioCosto: 0 },
        allocations: [{
          id: 'allocation-1',
          cantidad: 10,
          compraDocumentoItem: { precioUnitario: 20 },
        }],
      }],
    }
    prismaMock.reconciliacionVenta.findMany.mockImplementation(async ({ where }: any) => {
      if (where?.fechaReconciliacion?.gte) {
        return [
          {
            reconciliacionId: 'current-payment', monto: 500, moneda: 'CUP',
            montoConvertido: null, tasaCambio: null,
            fechaReconciliacion: new Date('2025-02-10T12:00:00Z'),
            tipoReconciliacion: null, venta: activeSale,
          },
          {
            reconciliacionId: 'deleted-payment', monto: 100, moneda: 'CUP',
            montoConvertido: null, tasaCambio: null,
            fechaReconciliacion: new Date('2025-02-11T12:00:00Z'),
            tipoReconciliacion: null,
            venta: { ...activeSale, ventaId: 'deleted-sale', deletedAt: new Date() },
          },
        ]
      }
      return [
        {
          reconciliacionId: 'opening-payment', ventaId: 'discounted-sale',
          tipoReconciliacion: null, monto: 800, moneda: 'CUP', montoConvertido: null,
          tasaCambio: null, fechaReconciliacion: new Date('2024-12-10T12:00:00Z'),
        },
        {
          reconciliacionId: 'bad-opening', ventaId: 'discounted-sale',
          tipoReconciliacion: null, monto: 10, moneda: 'USD', montoConvertido: null,
          tasaCambio: null, fechaReconciliacion: new Date('2024-12-11T12:00:00Z'),
        },
      ]
    })

    const { getBalanceFinanciero } = await import('@/features/contabilidad/api/exchange-handlers')
    const request = new NextRequest('http://localhost/api/contabilidad/balance-financiero?year=2025')
    const response = await getBalanceFinanciero(request, baseUser as any)
    const body = await response.json()

    expect(body.estadoResultados.anual.income.sales).toBe(100)
    expect(body.estadoResultados.anual.costOfSales.total).toBeCloseTo(200 / 9)
    expect(body.estadoResultados.incidencias).toContainEqual({
      code: 'PAYMENT_EXCEEDS_DOCUMENT',
      movementId: 'current-payment',
      affectedAmount: 400,
    })
    expect(body.estadoResultados.incidencias).toContainEqual({
      code: 'DELETED_DOCUMENT',
      movementId: 'deleted-payment',
      affectedAmount: 100,
    })
    expect(body.estadoResultados.incidencias).toContainEqual({
      code: 'MISSING_CONVERSION',
      movementId: 'bad-opening',
      affectedAmount: 10,
    })
  })

  it('limita servicios comprados en su moneda y reconoce el pago convertido', async () => {
    prismaMock.reconciliacionGasto.findMany.mockImplementation(currentPeriodRows([{
      reconciliacionId: 'foreign-service-payment',
      tipoGasto: 'servicio',
      referenciaId: 'foreign-service',
      monto: 50,
      moneda: 'USD',
      montoConvertido: 1200,
      tasaCambio: 24,
      fechaReconciliacion: new Date('2025-07-10T12:00:00Z'),
      estado: 'PAGADA',
      gastoCompra: null,
      gastoDE: null,
      pagoSalario: null,
    }]))
    prismaMock.compraServicio.findMany.mockResolvedValue([{
      compraServicioId: 'foreign-service',
      total: 100,
      moneda: 'USD',
    }])

    const { getBalanceFinanciero } = await import('@/features/contabilidad/api/exchange-handlers')
    const request = new NextRequest('http://localhost/api/contabilidad/balance-financiero?year=2025')
    const response = await getBalanceFinanciero(request, baseUser as any)
    const body = await response.json()

    expect(body.estadoResultados.anual.operatingExpenses.purchasedServices).toBe(1200)
    expect(body.estadoResultados.incidencias).not.toContainEqual(expect.objectContaining({
      code: 'PAYMENT_EXCEEDS_DOCUMENT',
    }))
  })

  it('calcula inventario del balance desde StockUbicacion y no desde producto.stock', async () => {
    prismaMock.producto.findMany.mockResolvedValue([{ stock: 999, precioCosto: 10 }])
    prismaMock.stockUbicacion.findMany.mockResolvedValue([
      { cantidad: 2, producto: { precioCosto: 10 } },
      { cantidad: 3, producto: { precioCosto: 10 } },
    ])

    const { getBalanceFinanciero } = await import('@/features/contabilidad/api/exchange-handlers')
    const request = new NextRequest('http://localhost/api/contabilidad/balance-financiero?year=2025')
    const response = await getBalanceFinanciero(request, baseUser as any)
    const body = await response.json()

    expect(body.balance.activos.inventario).toBe(50)
  })
})
