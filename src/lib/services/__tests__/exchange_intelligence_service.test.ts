import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { DebtExposureResponse, PaymentEfficiencyResponse } from '@/lib/types/exchange-intelligence'

// Generadores de datos compartidos
const debtArbitrary = fc.record({
  id: fc.string(),
  montoRecibido: fc.float({ min: Math.fround(1), max: Math.fround(1000000) }),
  moneda: fc.constantFrom('USD', 'EUR', 'GBP', 'CAD', 'MXN'),
  fechaRegistro: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  estado: fc.constant('ACTIVA'),
  entidadPrestamista: fc.option(fc.string()),
})

const exchangeRateArbitrary = fc.record({
  monedaOrigenId: fc.constantFrom('USD', 'EUR', 'GBP', 'CAD', 'MXN'),
  tasa: fc.float({ min: Math.fround(1), max: Math.fround(1000) }),
  fechaVigencia: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
})

const transactionArbitrary = fc.record({
  id: fc.string(),
  fechaTransferencia: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  monedaOrigen: fc.constantFrom('USD', 'EUR', 'GBP', 'CAD', 'MXN'),
  montoOrigen: fc.float({ min: Math.fround(1), max: Math.fround(1000000) }),
  tasaCambio: fc.float({ min: Math.fround(1), max: Math.fround(1000) }),
})

// Función helper para crear el mock de Prisma
function createMockPrisma() {
  return {
    inyeccionCapital: {
      findMany: vi.fn(),
    },
    moneda: {
      findFirst: vi.fn(),
    },
    reconciliacionGasto: {
      findMany: vi.fn(),
    },
    tasaCambio: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    transferenciaBancaria: {
      findMany: vi.fn(),
    },
  }
}

describe('ExchangeIntelligenceService - Debt Exposure Property Tests', () => {
  let service: InstanceType<typeof import('../exchange_intelligence_service').ExchangeIntelligenceService>
  let mockPrisma: any

  beforeEach(async () => {
    // Crear nuevo mock para cada test
    mockPrisma = createMockPrisma()
    
    // Resetear todos los mocks
    vi.clearAllMocks()
    
    // Mockear Prisma con el nuevo mock
    vi.doMock('@/lib/prisma', () => ({
      prisma: mockPrisma,
      default: mockPrisma,
    }))
    
    // Limpiar cache del módulo para que se use el nuevo mock
    vi.resetModules()
    
    // Recrear el servicio después del mock
    const { ExchangeIntelligenceService } = await import('../exchange_intelligence_service')
    service = new ExchangeIntelligenceService()
  })

  /**
   * @description Property test: La suma de montos originales en desglose debe igualar deuda_original_local
   */
  it('La suma de monto_original en desglose_por_moneda debe ser igual a deuda_original_local', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(debtArbitrary, { minLength: 1, maxLength: 10 }),
        fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 20 }),
        async (deudas, tasas) => {
          mockPrisma.inyeccionCapital.findMany.mockResolvedValue(deudas)
          mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
          mockPrisma.tasaCambio.findFirst.mockImplementation((query: any) => {
            const { where } = query
            const matchingRate = tasas.find(t =>
              t.monedaOrigenId === where.monedaOrigenId &&
              t.fechaVigencia <= where.fechaVigencia.$lte
            )
            return Promise.resolve(matchingRate || null)
          })

          const fecha_corte = new Date().toISOString()
          const result: DebtExposureResponse = await service.calculate_debt_exposure(fecha_corte)

          const sumaMontoOriginal = result.desglose_por_moneda.reduce((sum, item) => sum + item.monto_original, 0)
          expect(sumaMontoOriginal).toBeCloseTo(result.deuda_original_local, 2)
        }
      )
    )
  })

  /**
   * @description Property test: La suma de montos actuales en desglose debe igualar deuda_actual_local
   */
  it('La suma de monto_actual en desglose_por_moneda debe ser igual a deuda_actual_local', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(debtArbitrary, { minLength: 1, maxLength: 10 }),
        fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 20 }),
        async (deudas, tasas) => {
          mockPrisma.inyeccionCapital.findMany.mockResolvedValue(deudas)
          mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
          mockPrisma.tasaCambio.findFirst.mockImplementation((query: any) => {
            const { where } = query
            const matchingRate = tasas.find(t =>
              t.monedaOrigenId === where.monedaOrigenId &&
              t.fechaVigencia <= where.fechaVigencia.$lte
            )
            return Promise.resolve(matchingRate || null)
          })

          const fecha_corte = new Date().toISOString()
          const result: DebtExposureResponse = await service.calculate_debt_exposure(fecha_corte)

          const sumaMontoActual = result.desglose_por_moneda.reduce((sum, item) => sum + item.monto_actual, 0)
          expect(sumaMontoActual).toBeCloseTo(result.deuda_actual_local, 2)
        }
      )
    )
  })

  /**
   * @description Property test: La suma de diferencias en desglose debe igualar perdida_no_realizada
   */
  it('La suma de diferencia en desglose_por_moneda debe ser igual a perdida_no_realizada', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(debtArbitrary, { minLength: 1, maxLength: 10 }),
        fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 20 }),
        async (deudas, tasas) => {
          mockPrisma.inyeccionCapital.findMany.mockResolvedValue(deudas)
          mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
          mockPrisma.tasaCambio.findFirst.mockImplementation((query: any) => {
            const { where } = query
            const matchingRate = tasas.find(t =>
              t.monedaOrigenId === where.monedaOrigenId &&
              t.fechaVigencia <= where.fechaVigencia.$lte
            )
            return Promise.resolve(matchingRate || null)
          })

          const fecha_corte = new Date().toISOString()
          const result: DebtExposureResponse = await service.calculate_debt_exposure(fecha_corte)

          const sumaDiferencias = result.desglose_por_moneda.reduce((sum, item) => sum + item.diferencia, 0)
          expect(sumaDiferencias).toBeCloseTo(result.perdida_no_realizada, 2)
        }
      )
    )
  })

  /**
   * @description Property test: perdida_no_realizada = deuda_actual_local - deuda_original_local
   */
  it('perdida_no_realizada debe ser igual a deuda_actual_local - deuda_original_local', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(debtArbitrary, { minLength: 1, maxLength: 10 }),
        fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 20 }),
        async (deudas, tasas) => {
          mockPrisma.inyeccionCapital.findMany.mockResolvedValue(deudas)
          mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
          mockPrisma.tasaCambio.findFirst.mockImplementation((query: any) => {
            const { where } = query
            const matchingRate = tasas.find(t =>
              t.monedaOrigenId === where.monedaOrigenId &&
              t.fechaVigencia <= where.fechaVigencia.$lte
            )
            return Promise.resolve(matchingRate || null)
          })

          const fecha_corte = new Date().toISOString()
          const result: DebtExposureResponse = await service.calculate_debt_exposure(fecha_corte)

          const expectedPerdida = result.deuda_actual_local - result.deuda_original_local
          expect(result.perdida_no_realizada).toBeCloseTo(expectedPerdida, 2)
        }
      )
    )
  })

  /**
   * @description Property test: Para cada entrada en desglose, diferencia = monto_actual - monto_original
   */
  it('Para cada moneda en desglose, diferencia debe ser monto_actual - monto_original', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(debtArbitrary, { minLength: 1, maxLength: 10 }),
        fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 20 }),
        async (deudas, tasas) => {
          mockPrisma.inyeccionCapital.findMany.mockResolvedValue(deudas)
          mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
          mockPrisma.tasaCambio.findFirst.mockImplementation((query: any) => {
            const { where } = query
            const matchingRate = tasas.find(t =>
              t.monedaOrigenId === where.monedaOrigenId &&
              t.fechaVigencia <= where.fechaVigencia.$lte
            )
            return Promise.resolve(matchingRate || null)
          })

          const fecha_corte = new Date().toISOString()
          const result: DebtExposureResponse = await service.calculate_debt_exposure(fecha_corte)

          for (const item of result.desglose_por_moneda) {
            const expectedDiferencia = item.monto_actual - item.monto_original
            expect(item.diferencia).toBeCloseTo(expectedDiferencia, 2)
          }
        }
      )
    )
  })

  /**
   * @description Property test: Todos los montos deben ser no negativos
   */
  it('Todos los montos calculados deben ser no negativos', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(debtArbitrary, { minLength: 1, maxLength: 10 }),
        fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 20 }),
        async (deudas, tasas) => {
          mockPrisma.inyeccionCapital.findMany.mockResolvedValue(deudas)
          mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
          mockPrisma.tasaCambio.findFirst.mockImplementation((query: any) => {
            const { where } = query
            const matchingRate = tasas.find(t =>
              t.monedaOrigenId === where.monedaOrigenId &&
              t.fechaVigencia <= where.fechaVigencia.$lte
            )
            return Promise.resolve(matchingRate || null)
          })

          const fecha_corte = new Date().toISOString()
          const result: DebtExposureResponse = await service.calculate_debt_exposure(fecha_corte)

          expect(result.deuda_original_local).toBeGreaterThanOrEqual(0)
          expect(result.deuda_actual_local).toBeGreaterThanOrEqual(0)

          for (const item of result.desglose_por_moneda) {
            expect(item.monto_original).toBeGreaterThanOrEqual(0)
            expect(item.monto_actual).toBeGreaterThanOrEqual(0)
            expect(item.antiguedad_dias).toBeGreaterThanOrEqual(0)
          }
        }
      )
    )
  })

  /**
   * @description Property test: Consistencia del desglose por moneda
   */
  it('El desglose por moneda debe incluir todas las monedas presentes en las deudas activas', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(debtArbitrary, { minLength: 1, maxLength: 10 }),
        fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 20 }),
        async (deudas, tasas) => {
          mockPrisma.inyeccionCapital.findMany.mockResolvedValue(deudas)
          mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
          mockPrisma.tasaCambio.findFirst.mockImplementation((query: any) => {
            const { where } = query
            const matchingRate = tasas.find(t =>
              t.monedaOrigenId === where.monedaOrigenId &&
              t.fechaVigencia <= where.fechaVigencia.$lte
            )
            return Promise.resolve(matchingRate || null)
          })

          const fecha_corte = new Date().toISOString()
          const result: DebtExposureResponse = await service.calculate_debt_exposure(fecha_corte)

          const monedasEnDeudas = new Set(deudas.map(d => d.moneda))
          const monedasEnDesglose = new Set(result.desglose_por_moneda.map(d => d.moneda))

          for (const moneda of monedasEnDeudas) {
            expect(monedasEnDesglose.has(moneda)).toBe(true)
          }
        }
      )
    )
  })

  /**
   * @description Caso sin deudas debe retornar valores cero
   */
  it('Caso sin deudas debe retornar estructura con valores cero', async () => {
    mockPrisma.inyeccionCapital.findMany.mockResolvedValue([])
    mockPrisma.tasaCambio.findMany.mockResolvedValue([])
    mockPrisma.tasaCambio.findFirst.mockResolvedValue(null)

    const fecha_corte = new Date().toISOString()
    const result: DebtExposureResponse = await service.calculate_debt_exposure(fecha_corte)

    expect(result.deuda_original_local).toBe(0)
    expect(result.deuda_actual_local).toBe(0)
    expect(result.perdida_no_realizada).toBe(0)
    expect(result.desglose_por_moneda).toEqual([])
    expect(result.alertas).toEqual([])
  })

  /**
   * @description Caso edge: Deudas en una sola moneda
   */
  it('Deudas en una sola moneda deben agruparse correctamente en el desglose', async () => {
    const deudas = [
      {
        id: '1',
        montoRecibido: 1000,
        moneda: 'USD',
        fechaRegistro: new Date('2023-01-01'),
        estado: 'ACTIVA',
        entidadPrestamista: 'Banco A',
      },
      {
        id: '2',
        montoRecibido: 2000,
        moneda: 'USD',
        fechaRegistro: new Date('2023-02-01'),
        estado: 'ACTIVA',
        entidadPrestamista: 'Banco B',
      },
    ]

    const tasas = [
      {
        monedaOrigenId: 'USD',
        tasa: 25,
        fechaVigencia: new Date('2023-01-01'),
      },
      {
        monedaOrigenId: 'USD',
        tasa: 26,
        fechaVigencia: new Date(),
      },
    ]

    mockPrisma.inyeccionCapital.findMany.mockResolvedValue(deudas)
    mockPrisma.tasaCambio.findMany.mockResolvedValue([tasas[1]])
    mockPrisma.tasaCambio.findFirst.mockImplementation((query: any) => {
      const { where: whereClause } = query
      if (whereClause.fechaVigencia.$lte.getTime() === new Date('2023-01-01').getTime()) {
        return Promise.resolve(tasas[0])
      }
      if (whereClause.fechaVigencia.$lte.getTime() === new Date('2023-02-01').getTime()) {
        return Promise.resolve(tasas[0])
      }
      return Promise.resolve(tasas[1])
    })

    const fecha_corte = new Date().toISOString()
    const result: DebtExposureResponse = await service.calculate_debt_exposure(fecha_corte)

    expect(result.desglose_por_moneda).toHaveLength(1)
    expect(result.desglose_por_moneda[0].moneda).toBe('USD')

    const expected_original = (1000 * 25) + (2000 * 25)
    const expected_actual = (1000 * 26) + (2000 * 26)
    const expected_perdida = expected_actual - expected_original

    expect(result.deuda_original_local).toBe(expected_original)
    expect(result.deuda_actual_local).toBe(expected_actual)
    expect(result.perdida_no_realizada).toBe(expected_perdida)
    expect(result.desglose_por_moneda[0].monto_original).toBe(expected_original)
    expect(result.desglose_por_moneda[0].monto_actual).toBe(expected_actual)
    expect(result.desglose_por_moneda[0].diferencia).toBe(expected_perdida)
  })

  /**
   * @description Caso edge: Tasas históricas faltantes deben usar fallback de 1
   */
  it('Tasas históricas faltantes deben usar fallback de 1 y calcular correctamente', async () => {
    const deudas = [
      {
        id: '1',
        montoRecibido: 1000,
        moneda: 'EUR',
        fechaRegistro: new Date('2023-01-01'),
        estado: 'ACTIVA',
        entidadPrestamista: 'Banco C',
      },
    ]

    const tasas_actuales = [
      {
        monedaOrigenId: 'EUR',
        tasa: 28,
        fechaVigencia: new Date(),
      },
    ]

    mockPrisma.inyeccionCapital.findMany.mockResolvedValue(deudas)
    mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas_actuales)
    mockPrisma.tasaCambio.findFirst.mockResolvedValue(null)

    const fecha_corte = new Date().toISOString()
    const result: DebtExposureResponse = await service.calculate_debt_exposure(fecha_corte)

    const expected_original = 1000 * 1
    const expected_actual = 1000 * 28
    const expected_perdida = expected_actual - expected_original

    expect(result.deuda_original_local).toBe(expected_original)
    expect(result.deuda_actual_local).toBe(expected_actual)
    expect(result.perdida_no_realizada).toBe(expected_perdida)
    expect(result.desglose_por_moneda).toHaveLength(1)
    expect(result.desglose_por_moneda[0].moneda).toBe('EUR')
    expect(result.desglose_por_moneda[0].monto_original).toBe(expected_original)
    expect(result.desglose_por_moneda[0].monto_actual).toBe(expected_actual)
    expect(result.desglose_por_moneda[0].diferencia).toBe(expected_perdida)
  })
})

describe('ExchangeIntelligenceService - Payment Efficiency Property Tests', () => {
  let service: InstanceType<typeof import('../exchange_intelligence_service').ExchangeIntelligenceService>
  let mockPrisma: any

  beforeEach(async () => {
    // Crear nuevo mock para cada test
    mockPrisma = createMockPrisma()
    
    // Resetear todos los mocks
    vi.clearAllMocks()
    
    // Mockear Prisma con el nuevo mock
    vi.doMock('@/lib/prisma', () => ({
      prisma: mockPrisma,
      default: mockPrisma,
    }))
    
    // Limpiar cache del módulo para que se use el nuevo mock
    vi.resetModules()
    
    // Recrear el servicio después del mock
    const { ExchangeIntelligenceService } = await import('../exchange_intelligence_service')
    service = new ExchangeIntelligenceService()
  })

  /**
   * @description Property test: El spread bancario se calcula correctamente para cada transacción
   */
  it('El spread bancario debe calcularse correctamente como ((tasa_real - tasa_oficial) / tasa_oficial) * 100', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(transactionArbitrary, { minLength: 1, maxLength: 10 }),
        fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 20 }),
        async (transacciones, tasas) => {
          mockPrisma.transferenciaBancaria.findMany.mockResolvedValue(transacciones)
          mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
          mockPrisma.tasaCambio.findFirst.mockImplementation((query: any) => {
            const { where } = query
            const matchingRate = tasas.find(t =>
              t.monedaOrigenId === where.monedaOrigenId &&
              t.fechaVigencia <= where.fechaVigencia.$lte
            )
            return Promise.resolve(matchingRate || null)
          })

          const fecha_inicio = '2020-01-01'
          const fecha_fin = new Date().toISOString()
          const result: PaymentEfficiencyResponse = await service.calculate_payment_efficiency(fecha_inicio, fecha_fin)

          for (const tx of result.transacciones) {
            const transaccionOriginal = transacciones.find(t =>
              t.fechaTransferencia.toISOString().split('T')[0] === tx.fecha &&
              t.monedaOrigen === tx.moneda
            )

            if (transaccionOriginal) {
              const expectedSpread = ((tx.tasa_real - tx.tasa_oficial) / tx.tasa_oficial) * 100
              expect(tx.spread_bancario).toBeCloseTo(expectedSpread, 2)
            }
          }
        }
      )
    )
  })

  /**
   * @description Property test: El spread promedio ponderado se calcula correctamente
   */
  it('El spread promedio ponderado debe ser la suma ponderada de spreads individuales', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(transactionArbitrary, { minLength: 1, maxLength: 10 }),
        fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 20 }),
        async (transacciones, tasas) => {
          mockPrisma.transferenciaBancaria.findMany.mockResolvedValue(transacciones)
          mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
          mockPrisma.tasaCambio.findFirst.mockImplementation((query: any) => {
            const { where } = query
            const matchingRate = tasas.find(t =>
              t.monedaOrigenId === where.monedaOrigenId &&
              t.fechaVigencia <= where.fechaVigencia.$lte
            )
            return Promise.resolve(matchingRate || null)
          })

          const fecha_inicio = '2020-01-01'
          const fecha_fin = new Date().toISOString()
          const result: PaymentEfficiencyResponse = await service.calculate_payment_efficiency(fecha_inicio, fecha_fin)

          let sumaSpreadPonderado = 0
          let sumaMontos = 0

          for (const tx of result.transacciones) {
            sumaSpreadPonderado += tx.spread_bancario * tx.monto
            sumaMontos += tx.monto
          }

          const expectedSpreadPromedio = sumaMontos > 0 ? sumaSpreadPonderado / sumaMontos : 0
          expect(result.spread_promedio_ponderado).toBeCloseTo(expectedSpreadPromedio, 2)
        }
      )
    )
  })

  /**
   * @description Property test: El spread promedio ponderado está entre los spreads individuales
   */
  it('El spread promedio ponderado debe estar entre el mínimo y máximo de los spreads individuales', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(transactionArbitrary, { minLength: 2, maxLength: 10 }),
        fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 20 }),
        async (transacciones, tasas) => {
          mockPrisma.transferenciaBancaria.findMany.mockResolvedValue(transacciones)
          mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
          mockPrisma.tasaCambio.findFirst.mockImplementation((query: any) => {
            const { where } = query
            const matchingRate = tasas.find(t =>
              t.monedaOrigenId === where.monedaOrigenId &&
              t.fechaVigencia <= where.fechaVigencia.$lte
            )
            return Promise.resolve(matchingRate || null)
          })

          const fecha_inicio = '2020-01-01'
          const fecha_fin = new Date().toISOString()
          const result: PaymentEfficiencyResponse = await service.calculate_payment_efficiency(fecha_inicio, fecha_fin)

          if (result.transacciones.length > 0) {
            const spreads = result.transacciones.map(tx => tx.spread_bancario)
            const minSpread = Math.min(...spreads)
            const maxSpread = Math.max(...spreads)

            expect(result.spread_promedio_ponderado).toBeGreaterThanOrEqual(minSpread - 0.01)
            expect(result.spread_promedio_ponderado).toBeLessThanOrEqual(maxSpread + 0.01)
          }
        }
      )
    )
  })

  /**
   * @description Property test: Las transacciones se identifican correctamente por fecha y moneda
   */
  it('Las transacciones deben identificarse correctamente por fecha y moneda', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(transactionArbitrary, { minLength: 1, maxLength: 10 }),
        fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 20 }),
        async (transacciones, tasas) => {
          mockPrisma.transferenciaBancaria.findMany.mockResolvedValue(transacciones)
          mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
          mockPrisma.tasaCambio.findFirst.mockImplementation((query: any) => {
            const { where } = query
            const matchingRate = tasas.find(t =>
              t.monedaOrigenId === where.monedaOrigenId &&
              t.fechaVigencia <= where.fechaVigencia.$lte
            )
            return Promise.resolve(matchingRate || null)
          })

          const fecha_inicio = '2020-01-01'
          const fecha_fin = new Date().toISOString()
          const result: PaymentEfficiencyResponse = await service.calculate_payment_efficiency(fecha_inicio, fecha_fin)

          for (const tx of result.transacciones) {
            const transaccionOriginal = transacciones.find(t =>
              t.fechaTransferencia.toISOString().split('T')[0] === tx.fecha &&
              t.monedaOrigen === tx.moneda
            )

            expect(transaccionOriginal).toBeDefined()
            expect(tx.monto).toBe(Number(transaccionOriginal!.montoOrigen))
            expect(tx.tasa_real).toBe(Number(transaccionOriginal!.tasaCambio))
          }
        }
      )
    )
  })

  /**
   * @description Caso sin transacciones debe retornar valores cero
   */
  it('Caso sin transacciones debe retornar estructura con valores cero', async () => {
    mockPrisma.transferenciaBancaria.findMany.mockResolvedValue([])
    mockPrisma.tasaCambio.findMany.mockResolvedValue([])
    mockPrisma.tasaCambio.findFirst.mockResolvedValue(null)

    const fecha_inicio = '2020-01-01'
    const fecha_fin = new Date().toISOString()
    const result: PaymentEfficiencyResponse = await service.calculate_payment_efficiency(fecha_inicio, fecha_fin)

    expect(result.transacciones).toEqual([])
    expect(result.spread_promedio_ponderado).toBe(0)
    expect(result.recomendacion_renegociacion).toBe(false)
  })

  /**
   * @description Caso edge: Una sola transacción
   */
  it('Una sola transacción debe calcular spread correctamente', async () => {
    const transacciones = [
      {
        id: '1',
        fechaTransferencia: new Date('2023-01-01'),
        monedaOrigen: 'USD',
        montoOrigen: 1000,
        tasaCambio: 25,
      },
    ]

    const tasas = [
      {
        monedaOrigenId: 'USD',
        tasa: 24,
        fechaVigencia: new Date('2023-01-01'),
      },
    ]

    mockPrisma.transferenciaBancaria.findMany.mockResolvedValue(transacciones)
    mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
    mockPrisma.tasaCambio.findFirst.mockResolvedValue(tasas[0])

    const fecha_inicio = '2023-01-01'
    const fecha_fin = '2023-01-01'
    const result: PaymentEfficiencyResponse = await service.calculate_payment_efficiency(fecha_inicio, fecha_fin)

    expect(result.transacciones).toHaveLength(1)
    expect(result.transacciones[0].moneda).toBe('USD')
    expect(result.transacciones[0].monto).toBe(1000)
    expect(result.transacciones[0].tasa_oficial).toBe(24)
    expect(result.transacciones[0].tasa_real).toBe(25)

    const expectedSpread = ((25 - 24) / 24) * 100
    expect(result.transacciones[0].spread_bancario).toBeCloseTo(expectedSpread, 2)
    expect(result.spread_promedio_ponderado).toBeCloseTo(expectedSpread, 2)
    expect(result.recomendacion_renegociacion).toBe(false)
  })

  /**
   * @description Caso edge: Spread alto debe recomendar renegociación
   */
  it('Spread promedio alto debe recomendar renegociación', async () => {
    const transacciones = [
      {
        id: '1',
        fechaTransferencia: new Date('2023-01-01'),
        monedaOrigen: 'USD',
        montoOrigen: 1000,
        tasaCambio: 30,
      },
    ]

    const tasas = [
      {
        monedaOrigenId: 'USD',
        tasa: 24,
        fechaVigencia: new Date('2023-01-01'),
      },
    ]

    mockPrisma.transferenciaBancaria.findMany.mockResolvedValue(transacciones)
    mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
    mockPrisma.tasaCambio.findFirst.mockResolvedValue(tasas[0])

    const fecha_inicio = '2023-01-01'
    const fecha_fin = '2023-01-01'
    const result: PaymentEfficiencyResponse = await service.calculate_payment_efficiency(fecha_inicio, fecha_fin)

    const expectedSpread = ((30 - 24) / 24) * 100
    expect(result.spread_promedio_ponderado).toBeCloseTo(expectedSpread, 2)
    expect(result.recomendacion_renegociacion).toBe(true)
  })
})
