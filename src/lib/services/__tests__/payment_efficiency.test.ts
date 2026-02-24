import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { ExchangeIntelligenceService } from '../exchange_intelligence_service'
import { PaymentEfficiencyResponse } from '@/lib/types/exchange-intelligence'

// Generadores de datos
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

describe('ExchangeIntelligenceService - Payment Efficiency Property Tests', () => {
  let service: ExchangeIntelligenceService
  let mockPrisma: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    
    // Crear nuevo mock para cada test
    mockPrisma = {
      inyeccionCapital: {
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
    
    // Aplicar mock antes de crear el servicio
    vi.doMock('@/generated/prisma', () => ({
      PrismaClient: vi.fn(() => mockPrisma),
    }))
    
    // Recrear el servicio después del mock
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
