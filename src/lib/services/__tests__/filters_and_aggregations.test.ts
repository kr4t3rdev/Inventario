import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { ExchangeIntelligenceService } from '../exchange_intelligence_service'

// Generadores de datos para pruebas de filtros
const productArbitrary = fc.record({
  id: fc.string(),
  nombre: fc.string(),
  stock: fc.float({ min: Math.fround(0), max: Math.fround(10000) }),
  categoriaId: fc.option(fc.string()),
  almacenId: fc.option(fc.string()),
  vendorId: fc.option(fc.string()),
  gastoCompras: fc.array(
    fc.record({
      precioUnitario: fc.float({ min: Math.fround(0.01), max: Math.fround(10000) }),
      fechaCompra: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    }),
    { minLength: 0, maxLength: 10 }
  ),
})

const purchaseArbitrary = fc.record({
  precioUnitario: fc.float({ min: Math.fround(0.01), max: Math.fround(10000) }),
  fechaCompra: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
})

const exchangeRateArbitrary = fc.record({
  monedaOrigenId: fc.constantFrom('USD', 'EUR', 'GBP', 'CAD', 'MXN'),
  tasa: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }),
  fechaVigencia: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
})

const debtArbitrary = fc.record({
  id: fc.string(),
  montoRecibido: fc.float({ min: Math.fround(0.01), max: Math.fround(1000000) }),
  moneda: fc.constantFrom('USD', 'EUR', 'GBP', 'CAD', 'MXN'),
  fechaRegistro: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  estado: fc.constant('ACTIVA'),
})

// Función helper para crear el mock de Prisma
function createMockPrisma() {
  return {
    producto: {
      findMany: vi.fn(),
    },
    inyeccionCapital: {
      findMany: vi.fn(),
    },
    tasaCambio: {
      findMany: vi.fn(),
      findFirst: vi.fn((args: any) => {
        // Mock implementation for findFirst
        return Promise.resolve(null)
      }),
    },
  }
}

describe('ExchangeIntelligenceService - Property Tests for Filters and Aggregations', () => {
  let service: ExchangeIntelligenceService
  let mockPrisma: any

  beforeEach(async () => {
    // Crear nuevo mock para cada test
    mockPrisma = createMockPrisma()

    // Resetear todos los mocks
    vi.clearAllMocks()

    // Mockear Prisma con el nuevo mock
    vi.doMock('@/generated/prisma', () => ({
      PrismaClient: vi.fn(() => mockPrisma),
    }))

    // Limpiar cache del módulo para que se use el nuevo mock
    vi.resetModules()

    // Importar dinámicamente después del mock
    const { ExchangeIntelligenceService: ServiceClass } = await import('../exchange_intelligence_service')
    service = new ServiceClass()
  })

  describe('Property 11: Filter Application Consistency', () => {
    /**
     * Feature: dashboard-inteligencia-cambiaria, Property 11: Filter Application Consistency
     * 
     * For any dataset and filter combination (category, warehouse, vendor, date range, currency),
     * the filtered results should satisfy:
     * - All returned items must match ALL applied filter criteria
     * - Applying filters in different orders produces the same result set
     * - Removing a filter expands the result set (monotonicity)
     * - Empty filter set returns all data
     */
    it('Todos los elementos retornados deben coincidir con TODOS los criterios de filtro aplicados - PROPIEDAD 11', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(productArbitrary, { minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 10 }), // categoria_id
          fc.string({ minLength: 1, maxLength: 10 }), // almacen_id
          fc.string({ minLength: 1, maxLength: 10 }), // vendor_id
          fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }), // fecha_inicio
          fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }), // fecha_fin
          fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 10 }),
          async (productos, categoriaId, almacenId, vendorId, fechaInicio, fechaFin, tasas) => {
            // Asegurar que fechaInicio <= fechaFin
            const fechaInicioValid = new Date(Math.min(fechaInicio.getTime(), fechaFin.getTime()))
            const fechaFinValid = new Date(Math.max(fechaInicio.getTime(), fechaFin.getTime()))

            // Validar que las fechas son válidas
            if (!isFinite(fechaInicioValid.getTime()) || !isFinite(fechaFinValid.getTime())) {
              return
            }

            // Filtrar productos con datos válidos
            const productosValidos = productos.filter(p => 
              isFinite(p.stock) && 
              p.gastoCompras.every(g => isFinite(g.precioUnitario) && isFinite(g.fechaCompra.getTime()))
            )

            if (productosValidos.length === 0) {
              return
            }

            // Preparar productos con los IDs de filtro
            const productosFiltrados = productosValidos.map((p, index) => ({
              ...p,
              categoriaId: categoriaId || `cat_${index}`,
              almacenId: almacenId || `alm_${index}`,
              vendorId: vendorId || `ven_${index}`,
            }))

            // Configurar mocks
            mockPrisma.producto.findMany.mockResolvedValue(productosFiltrados)
            mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
            mockPrisma.tasaCambio.findFirst.mockResolvedValue(tasas[0])

            // Ejecutar con filtros
            const result = await service.calculate_cost_impact(
              fechaInicioValid.toISOString(),
              fechaFinValid.toISOString(),
              {
                categoria_id: categoriaId,
                almacen_id: almacenId,
                vendor_id: vendorId,
              }
            )

            // Resetear mock
            mockPrisma.producto.findMany.mockResolvedValue(productosFiltrados)
            mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
            mockPrisma.tasaCambio.findFirst.mockResolvedValue(tasas[0])

            // Ejecutar sin filtros
            const resultSinFiltros = await service.calculate_cost_impact(
              fechaInicioValid.toISOString(),
              fechaFinValid.toISOString()
            )

            // PROPIEDAD 1: Los resultados con filtros deben ser un subconjunto de los resultados sin filtros
            expect(result.resumen.productos_afectados).toBeLessThanOrEqual(resultSinFiltros.resumen.productos_afectados)
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Feature: dashboard-inteligencia-cambiaria, Property 11: Filter Application Consistency
     * 
     * Applying filters in different orders must produce the same result set (commutativity)
     */
    it('Aplicar filtros en diferentes órdenes debe producir el mismo conjunto de resultados', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(productArbitrary, { minLength: 1, maxLength: 30 }),
          fc.string({ minLength: 1, maxLength: 10 }), // categoria_id
          fc.string({ minLength: 1, maxLength: 10 }), // almacen_id
          fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
          fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 5 }),
          async (productos, categoriaId, almacenId, fechaInicio, fechaFin, tasas) => {
            const fechaInicioValid = new Date(Math.min(fechaInicio.getTime(), fechaFin.getTime()))
            const fechaFinValid = new Date(Math.max(fechaInicio.getTime(), fechaFin.getTime()))

            // Validar que las fechas son válidas
            if (!isFinite(fechaInicioValid.getTime()) || !isFinite(fechaFinValid.getTime())) {
              return
            }

            // Filtrar productos con datos válidos
            const productosValidos = productos.filter(p => 
              isFinite(p.stock) && 
              p.gastoCompras.every(g => isFinite(g.precioUnitario) && isFinite(g.fechaCompra.getTime()))
            )

            if (productosValidos.length === 0) {
              return
            }

            // Preparar productos
            const productosPreparados = productosValidos.map((p, index) => ({
              ...p,
              categoriaId: index % 2 === 0 ? categoriaId : `cat_${index}`,
              almacenId: index % 2 === 0 ? almacenId : `alm_${index}`,
            }))

            mockPrisma.producto.findMany.mockResolvedValue(productosPreparados)
            mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
            mockPrisma.tasaCambio.findFirst.mockResolvedValue(tasas[0])

            // Aplicar filtros en orden 1: categoría primero, luego almacén
            const result1 = await service.calculate_cost_impact(
              fechaInicioValid.toISOString(),
              fechaFinValid.toISOString(),
              { categoria_id: categoriaId, almacen_id: almacenId }
            )

            // Resetear mock
            mockPrisma.producto.findMany.mockResolvedValue(productosPreparados)
            mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
            mockPrisma.tasaCambio.findFirst.mockResolvedValue(tasas[0])

            // Aplicar filtros en orden 2: almacén primero, luego categoría
            const result2 = await service.calculate_cost_impact(
              fechaInicioValid.toISOString(),
              fechaFinValid.toISOString(),
              { almacen_id: almacenId, categoria_id: categoriaId }
            )

            // Los resultados deben ser idénticos
            expect(result1.resumen.productos_afectados).toBe(result2.resumen.productos_afectados)
            expect(result1.resumen.incremento_promedio).toBeCloseTo(result2.resumen.incremento_promedio, 5)
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Feature: dashboard-inteligencia-cambiaria, Property 11: Filter Application Consistency
     * 
     * Removing a filter must expand the result set (monotonicity property)
     */
    it('Remover un filtro debe expandir el conjunto de resultados (monotonicity)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(productArbitrary, { minLength: 1, maxLength: 30 }),
          fc.string({ minLength: 1, maxLength: 10 }), // filtro_id
          fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
          fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 5 }),
          async (productos, filtroId, fechaInicio, fechaFin, tasas) => {
            const fechaInicioValid = new Date(Math.min(fechaInicio.getTime(), fechaFin.getTime()))
            const fechaFinValid = new Date(Math.max(fechaInicio.getTime(), fechaFin.getTime()))

            // Validar que las fechas son válidas
            if (!isFinite(fechaInicioValid.getTime()) || !isFinite(fechaFinValid.getTime())) {
              return
            }

            // Filtrar productos con datos válidos
            const productosValidos = productos.filter(p => 
              p.gastoCompras.every(g => isFinite(g.precioUnitario) && isFinite(g.fechaCompra.getTime()))
            )

            if (productosValidos.length === 0) {
              return
            }

            // Preparar productos con el filtro
            const productosPreparados = productosValidos.map((p, index) => ({
              ...p,
              categoriaId: index % 2 === 0 ? filtroId : `cat_${index}`,
              almacenId: `alm_${index}`,
              vendorId: `ven_${index}`,
            }))

            mockPrisma.producto.findMany.mockResolvedValue(productosPreparados)
            mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
            mockPrisma.tasaCambio.findFirst.mockResolvedValue(tasas[0])

            // Resultado CON filtro de categoría
            const resultConFiltro = await service.calculate_cost_impact(
              fechaInicioValid.toISOString(),
              fechaFinValid.toISOString(),
              { categoria_id: filtroId }
            )

            // Resetear mock
            mockPrisma.producto.findMany.mockResolvedValue(productosPreparados)
            mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
            mockPrisma.tasaCambio.findFirst.mockResolvedValue(tasas[0])

            // Resultado SIN filtro de categoría
            const resultSinFiltro = await service.calculate_cost_impact(
              fechaInicioValid.toISOString(),
              fechaFinValid.toISOString()
            )

            // Sin filtro debe tener >= productos que con filtro
            expect(resultSinFiltro.resumen.productos_afectados).toBeGreaterThanOrEqual(resultConFiltro.resumen.productos_afectados)
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Feature: dashboard-inteligencia-cambiaria, Property 11: Filter Application Consistency
     * 
     * Empty filter set must return all data
     */
    it('Un conjunto vacío de filtros debe retornar todos los datos', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(productArbitrary, { minLength: 1, maxLength: 30 }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
          fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 5 }),
          async (productos, fechaInicio, fechaFin, tasas) => {
            const fechaInicioValid = new Date(Math.min(fechaInicio.getTime(), fechaFin.getTime()))
            const fechaFinValid = new Date(Math.max(fechaInicio.getTime(), fechaFin.getTime()))

            // Validar que las fechas son válidas
            if (!isFinite(fechaInicioValid.getTime()) || !isFinite(fechaFinValid.getTime())) {
              return
            }

            // Filtrar productos con datos válidos
            const productosValidos = productos.filter(p => 
              isFinite(p.stock) && 
              p.gastoCompras.every(g => isFinite(g.precioUnitario) && isFinite(g.fechaCompra.getTime()))
            )

            if (productosValidos.length === 0) {
              return
            }

            mockPrisma.producto.findMany.mockResolvedValue(productosValidos)
            mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
            mockPrisma.tasaCambio.findFirst.mockResolvedValue(tasas[0])

            // Resultado sin filtros
            const resultSinFiltros = await service.calculate_cost_impact(
              fechaInicioValid.toISOString(),
              fechaFinValid.toISOString()
            )

            // Resetear mock
            mockPrisma.producto.findMany.mockResolvedValue(productosValidos)
            mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
            mockPrisma.tasaCambio.findFirst.mockResolvedValue(tasas[0])

            // Resultado con filtros vacíos explícitos
            const resultConFiltrosVacios = await service.calculate_cost_impact(
              fechaInicioValid.toISOString(),
              fechaFinValid.toISOString(),
              {}
            )

            // Ambos deben ser idénticos
            expect(resultSinFiltros.resumen.productos_afectados).toBe(resultConFiltrosVacios.resumen.productos_afectados)
            expect(resultSinFiltros.resumen.incremento_promedio).toBeCloseTo(resultConFiltrosVacios.resumen.incremento_promedio, 5)
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Feature: dashboard-inteligencia-cambiaria, Property 11: Filter Application Consistency
     * 
     * Los filtros deben ser aplicados de manera independiente
     */
    it('Los filtros deben ser aplicados de manera independiente', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(productArbitrary, { minLength: 1, maxLength: 30 }),
          fc.string({ minLength: 1, maxLength: 10 }), // filtro individual
          fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
          fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 5 }),
          async (productos, filtroId, fechaInicio, fechaFin, tasas) => {
            const fechaInicioValid = new Date(Math.min(fechaInicio.getTime(), fechaFin.getTime()))
            const fechaFinValid = new Date(Math.max(fechaInicio.getTime(), fechaFin.getTime()))

            // Validar que las fechas son válidas
            if (!isFinite(fechaInicioValid.getTime()) || !isFinite(fechaFinValid.getTime())) {
              return
            }

            // Filtrar productos con datos válidos y que tengan al menos una compra
            const productosValidos = productos.filter(p => 
              p.gastoCompras.length > 0 &&
              p.gastoCompras.every(g => isFinite(g.precioUnitario) && isFinite(g.fechaCompra.getTime()))
            )

            if (productosValidos.length === 0) {
              return
            }

            // Preparar productos con diferentes combinaciones de filtros
            const productosPreparados = productosValidos.map((p, index) => ({
              ...p,
              categoriaId: index % 3 === 0 ? filtroId : `cat_${index}`,
              almacenId: index % 3 === 1 ? filtroId : `alm_${index}`,
              vendorId: index % 3 === 2 ? filtroId : `ven_${index}`,
            }))

            // Contar cuántos productos coinciden con cada filtro
            const productosConCategoria = productosPreparados.filter(p => p.categoriaId === filtroId)
            const productosConAlmacen = productosPreparados.filter(p => p.almacenId === filtroId)
            const productosConVendor = productosPreparados.filter(p => p.vendorId === filtroId)

            // Si no hay productos que coincidan con los filtros, saltar
            if (productosConCategoria.length === 0 && productosConAlmacen.length === 0 && productosConVendor.length === 0) {
              return
            }

            mockPrisma.producto.findMany.mockResolvedValue(productosPreparados)
            mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
            mockPrisma.tasaCambio.findFirst.mockResolvedValue(tasas[0])

            // Probar filtro por categoría
            const resultCategoria = await service.calculate_cost_impact(
              fechaInicioValid.toISOString(),
              fechaFinValid.toISOString(),
              { categoria_id: filtroId }
            )

            // Resetear mock
            mockPrisma.producto.findMany.mockResolvedValue(productosPreparados)
            mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
            mockPrisma.tasaCambio.findFirst.mockResolvedValue(tasas[0])

            // Probar filtro por almacén
            const resultAlmacen = await service.calculate_cost_impact(
              fechaInicioValid.toISOString(),
              fechaFinValid.toISOString(),
              { almacen_id: filtroId }
            )

            // Resetear mock
            mockPrisma.producto.findMany.mockResolvedValue(productosPreparados)
            mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
            mockPrisma.tasaCambio.findFirst.mockResolvedValue(tasas[0])

            // Probar filtro por vendor
            const resultVendor = await service.calculate_cost_impact(
              fechaInicioValid.toISOString(),
              fechaFinValid.toISOString(),
              { vendor_id: filtroId }
            )

            // Los resultados deben ser consistentes con la lógica de filtrado
            // Cada resultado debe ser <= al número de productos que coinciden con el filtro
            expect(resultCategoria.resumen.productos_afectados).toBeLessThanOrEqual(productosConCategoria.length)
            expect(resultAlmacen.resumen.productos_afectados).toBeLessThanOrEqual(productosConAlmacen.length)
            expect(resultVendor.resumen.productos_afectados).toBeLessThanOrEqual(productosConVendor.length)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Property 12: Data Aggregation Correctness', () => {
    it('Las agregaciones de deuda por moneda deben ser matemáticamente correctas', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(debtArbitrary, { minLength: 1, maxLength: 20 }),
          fc.date({ min: new Date('2020-01-01'), max: new Date() }), // fecha_corte
          fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 10 }),
          async (deudas, fechaCorte, tasas) => {
            // Filtrar deudas con montos válidos (no NaN, no Infinity)
            const deudasValidas = deudas.filter(d => 
              isFinite(d.montoRecibido) && 
              d.montoRecibido > 0 &&
              isFinite(d.fechaRegistro.getTime())
            )

            if (deudasValidas.length === 0) {
              return
            }

            // Filtrar tasas con valores válidos
            const tasasValidas = tasas.filter(t => 
              isFinite(t.tasa) && 
              t.tasa > 0 &&
              isFinite(t.fechaVigencia.getTime())
            )

            if (tasasValidas.length === 0) {
              return
            }

            // Configurar mocks
            mockPrisma.inyeccionCapital.findMany.mockResolvedValue(deudasValidas)
            mockPrisma.tasaCambio.findMany.mockResolvedValue(tasasValidas)
            mockPrisma.tasaCambio.findFirst.mockImplementation((args: any) => {
              // Simular búsqueda de tasa por fecha
              const tasasFiltradas = tasasValidas
                .filter(t => t.monedaOrigenId === args.where.monedaOrigenId)
                .filter(t => t.fechaVigencia <= args.where.fechaVigencia.lte)
                .sort((a, b) => b.fechaVigencia.getTime() - a.fechaVigencia.getTime())

              return Promise.resolve(tasasFiltradas[0] || { tasa: 1 })
            })

            const result = await service.calculate_debt_exposure(fechaCorte.toISOString())

            // Verificar que la suma de montos por moneda coincide con los totales
            let totalOriginalCalculado = 0
            let totalActualCalculado = 0
            let totalDiferenciaCalculada = 0

            for (const desglose of result.desglose_por_moneda) {
              // Validar que los valores no sean NaN
              expect(isFinite(desglose.monto_original)).toBe(true)
              expect(isFinite(desglose.monto_actual)).toBe(true)
              expect(isFinite(desglose.diferencia)).toBe(true)

              totalOriginalCalculado += desglose.monto_original
              totalActualCalculado += desglose.monto_actual
              totalDiferenciaCalculada += desglose.diferencia
            }

            // Las sumas deben coincidir con los totales reportados (con tolerancia de punto flotante)
            expect(Math.abs(totalOriginalCalculado - result.deuda_original_local)).toBeLessThan(0.01)
            expect(Math.abs(totalActualCalculado - result.deuda_actual_local)).toBeLessThan(0.01)
            expect(Math.abs(totalDiferenciaCalculada - result.perdida_no_realizada)).toBeLessThan(0.01)

            // Verificar que cada desglose tenga diferencia = actual - original
            for (const desglose of result.desglose_por_moneda) {
              expect(desglose.diferencia).toBeCloseTo(desglose.monto_actual - desglose.monto_original, 5)
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it('Las agregaciones temporales en cost impact deben ser consistentes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(productArbitrary, { minLength: 1, maxLength: 15 }),
          fc.date({ min: new Date('2020-01-01'), max: new Date() }),
          fc.date({ min: new Date('2020-01-01'), max: new Date() }),
          fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 5 }),
          async (productos, fechaInicio, fechaFin, tasas) => {
            const fechaInicioValid = new Date(Math.min(fechaInicio.getTime(), fechaFin.getTime()))
            const fechaFinValid = new Date(Math.max(fechaInicio.getTime(), fechaFin.getTime()))

            // Validar que las fechas son válidas
            if (!isFinite(fechaInicioValid.getTime()) || !isFinite(fechaFinValid.getTime())) {
              return
            }

            // Filtrar productos con compras válidas
            const productosConCompras = productos
              .filter(p => p.gastoCompras.length > 0)
              .map(p => ({
                ...p,
                gastoCompras: p.gastoCompras.map(compra => ({
                  ...compra,
                  fechaCompra: new Date(fechaInicioValid.getTime() + Math.random() * (fechaFinValid.getTime() - fechaInicioValid.getTime()))
                }))
              }))

            if (productosConCompras.length === 0) {
              return
            }

            mockPrisma.producto.findMany.mockResolvedValue(productosConCompras)
            mockPrisma.tasaCambio.findMany.mockResolvedValue(tasas)
            mockPrisma.tasaCambio.findFirst.mockResolvedValue(tasas[0])

            const result = await service.calculate_cost_impact(
              fechaInicioValid.toISOString(),
              fechaFinValid.toISOString()
            )

            // Verificar que el timeline esté ordenado por fecha
            for (let i = 1; i < result.timeline.length; i++) {
              expect(result.timeline[i-1].fecha <= result.timeline[i].fecha).toBe(true)
            }

            // Verificar que todos los costos sean no negativos
            for (const entry of result.timeline) {
              expect(entry.costo_historico).toBeGreaterThanOrEqual(0)
              expect(entry.costo_reposicion).toBeGreaterThanOrEqual(0)
            }

            // Verificar que el incremento promedio sea consistente con las diferencias individuales
            if (result.timeline.length > 0) {
              const promedioCalculado = result.timeline.reduce((sum, entry) => sum + entry.diferencia_porcentual, 0) / result.timeline.length
              expect(result.resumen.incremento_promedio).toBeCloseTo(promedioCalculado, 5)
            }
          }
        ),
        { numRuns: 30 }
      )
    })

    it('La agregación de tendencias de deuda debe ser consistente con las reglas definidas', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(debtArbitrary, { minLength: 1, maxLength: 10 }),
          fc.date({ min: new Date('2020-01-01'), max: new Date() }),
          fc.array(exchangeRateArbitrary, { minLength: 1, maxLength: 10 }),
          async (deudas, fechaCorte, tasas) => {
            // Filtrar deudas con fechas válidas
            const deudasValidas = deudas.filter(d => 
              isFinite(d.fechaRegistro.getTime()) &&
              isFinite(d.montoRecibido) &&
              d.montoRecibido > 0
            )

            if (deudasValidas.length === 0) {
              return
            }

            // Filtrar tasas con valores válidos
            const tasasValidas = tasas.filter(t => 
              isFinite(t.tasa) && 
              t.tasa > 0 &&
              isFinite(t.fechaVigencia.getTime())
            )

            if (tasasValidas.length === 0) {
              return
            }

            mockPrisma.inyeccionCapital.findMany.mockResolvedValue(deudasValidas)
            mockPrisma.tasaCambio.findMany.mockResolvedValue(tasasValidas)
            mockPrisma.tasaCambio.findFirst.mockImplementation((args: any) => {
              // Devolver tasa basada en criterios de búsqueda
              const tasasFiltradas = tasasValidas
                .filter(t => args.where?.monedaOrigenId ? t.monedaOrigenId === args.where.monedaOrigenId : true)
                .filter(t => args.where?.fechaVigencia?.lte ? t.fechaVigencia <= args.where.fechaVigencia.lte : true)
                .sort((a, b) => b.fechaVigencia.getTime() - a.fechaVigencia.getTime())

              return Promise.resolve(tasasFiltradas[0] || { tasa: 1 })
            })

            const result = await service.calculate_debt_exposure(fechaCorte.toISOString())

            // Verificar que las tendencias estén correctamente clasificadas
            for (const desglose of result.desglose_por_moneda) {
              const tendencia = desglose.tendencia

              // La tendencia debe ser uno de los valores válidos
              expect(['alcista', 'bajista', 'estable']).toContain(tendencia)

              // Verificar que la antigüedad sea un número positivo
              expect(desglose.antiguedad_dias).toBeGreaterThanOrEqual(0)
            }

            // Verificar que las deudas activas están incluidas en el resultado
            if (deudasValidas.length > 0) {
              expect(result.desglose_por_moneda.length).toBeGreaterThan(0)
            }
          }
        ),
        { numRuns: 40 }
      )
    })
  })
})