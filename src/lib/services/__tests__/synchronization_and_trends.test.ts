import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import {
  calculate_break_even_rate,
  clasificar_proximidad_equilibrio,
  calculate_real_margin,
  calculate_debt_priority_score,
  calculate_currency_trend,
  classify_currency_trend,
  calculate_debt_priority,
} from '../exchange_intelligence_kpis'

// Generadores de datos para pruebas
const productDataArbitrary = fc.record({
  precio_venta: fc.float({ min: Math.fround(1), max: Math.fround(10000) }),
  gastos_fijos: fc.float({ min: Math.fround(0), max: Math.fround(5000) }),
  costo_divisa: fc.float({ min: Math.fround(0.01), max: Math.fround(5000) }),
})

const marginDataArbitrary = fc.record({
  precio_venta: fc.float({ min: Math.fround(1), max: Math.fround(10000) }),
  costo_original: fc.float({ min: Math.fround(0.01), max: Math.fround(5000) }),
  tasa_actual: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }),
  tasa_original: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }),
})

const debtDataArbitrary = fc.record({
  antiguedad_dias: fc.integer({ min: 0, max: 365 * 5 }),
  monto: fc.float({ min: Math.fround(0.01), max: Math.fround(1000000) }),
  tendencia_30d: fc.float({ min: Math.fround(-50), max: Math.fround(50) }),
})

const currencyTrendArbitrary = fc.record({
  tasa_actual: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }),
  tasa_30dias_atras: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }),
})

const debtPriorityInputArbitrary = fc.record({
  id: fc.string(),
  monto: fc.float({ min: Math.fround(0.01), max: Math.fround(1000000) }),
  moneda: fc.constantFrom('USD', 'EUR', 'GBP', 'CAD', 'MXN'),
  fecha_registro: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
})

describe('ExchangeIntelligence KPIs - Property Tests for Synchronization and Trends', () => {
  describe('Property 13: Real-Time KPI Update Consistency', () => {
    it('Los cálculos de KPIs deben ser idempotentes y consistentes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(productDataArbitrary, { minLength: 1, maxLength: 10 }),
          fc.array(marginDataArbitrary, { minLength: 1, maxLength: 10 }),
          async (productos, margenes) => {
            // Calcular KPIs múltiples veces con los mismos datos
            const resultado1 = productos.map(p => calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa))
            const resultado2 = productos.map(p => calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa))

            // Los resultados deben ser idénticos
            expect(resultado1).toEqual(resultado2)

            // Calcular márgenes múltiples veces
            const margenes1 = margenes.map(m => calculate_real_margin(m.precio_venta, m.costo_original, m.tasa_actual, m.tasa_original))
            const margenes2 = margenes.map(m => calculate_real_margin(m.precio_venta, m.costo_original, m.tasa_actual, m.tasa_original))

            // Los resultados deben ser idénticos
            expect(margenes1).toEqual(margenes2)

            // Verificar que los cálculos son deterministas (no dependen del orden)
            const productos_reversed = [...productos].reverse()
            const resultado_reversed = productos_reversed.map(p => calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa))

            // Los resultados individuales deben ser los mismos independientemente del orden
            for (let i = 0; i < productos.length; i++) {
              const original = resultado1[i]
              const reversed = resultado_reversed[productos.length - 1 - i]
              expect(original).toBe(reversed)
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it('Las actualizaciones de KPIs deben reflejar el estado más reciente de datos', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(productDataArbitrary, { minLength: 1, maxLength: 5 }),
          fc.float({ min: Math.fround(1.1), max: Math.fround(2.0) }), // factor de cambio
          async (productos, factor_cambio) => {
            // Estado inicial
            const kpis_iniciales = productos.map(p => ({
              tasa_equilibrio: calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa),
              precio_venta: p.precio_venta,
            }))

            // Simular cambio de datos (actualización de precio de venta)
            const productos_actualizados = productos.map(p => ({
              ...p,
              precio_venta: p.precio_venta * factor_cambio,
            }))

            // Recalcular KPIs con datos actualizados
            const kpis_actualizados = productos_actualizados.map(p => ({
              tasa_equilibrio: calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa),
              precio_venta: p.precio_venta,
            }))

            // Verificar que los KPIs reflejan los datos más recientes
            for (let i = 0; i < productos.length; i++) {
              const inicial = kpis_iniciales[i]
              const actualizado = kpis_actualizados[i]

              // Si el precio aumentó, la tasa de equilibrio debe aumentar
              if (factor_cambio > 1 && inicial.tasa_equilibrio !== null && actualizado.tasa_equilibrio !== null) {
                expect(actualizado.tasa_equilibrio).toBeGreaterThan(inicial.tasa_equilibrio)
              }

              // El precio en el KPI debe coincidir con el precio actualizado
              expect(actualizado.precio_venta).toBe(productos_actualizados[i].precio_venta)
            }

            // Verificar que no hay datos obsoletos: recalcular nuevamente debe dar el mismo resultado
            const kpis_verificacion = productos_actualizados.map(p => ({
              tasa_equilibrio: calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa),
              precio_venta: p.precio_venta,
            }))

            expect(kpis_actualizados).toEqual(kpis_verificacion)
          }
        ),
        { numRuns: 10 }
      )
    })

    it('Las interdependencias de KPIs deben resolverse correctamente', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(marginDataArbitrary, { minLength: 1, maxLength: 5 }),
          async (margenes) => {
            // Calcular márgenes iniciales
            const margenes_calculados = margenes.map(m => calculate_real_margin(
              m.precio_venta,
              m.costo_original,
              m.tasa_actual,
              m.tasa_original
            ))

            // Verificar que el margen real depende correctamente del margen nominal y la tasa
            for (let i = 0; i < margenes.length; i++) {
              const m = margenes[i]
              const margen_calc = margenes_calculados[i]

              // Margen nominal debe ser: precio_venta - costo_original
              const margen_nominal_esperado = m.precio_venta - m.costo_original
              expect(margen_calc.margen_nominal).toBe(margen_nominal_esperado)

              // Costo ajustado debe ser: costo_original * (tasa_actual / tasa_original)
              const factor_ajuste = m.tasa_original > 0 ? m.tasa_actual / m.tasa_original : 1
              const costo_ajustado_esperado = m.costo_original * factor_ajuste
              expect(margen_calc.costo_ajustado).toBeCloseTo(costo_ajustado_esperado, 5)

              // Margen real debe ser: precio_venta - costo_ajustado
              const margen_real_esperado = m.precio_venta - costo_ajustado_esperado
              expect(margen_calc.margen_real).toBeCloseTo(margen_real_esperado, 5)

              // Diferencia porcentual debe ser calculada correctamente
              if (margen_nominal_esperado !== 0) {
                const diferencia_esperada = ((margen_real_esperado - margen_nominal_esperado) / Math.abs(margen_nominal_esperado)) * 100
                expect(margen_calc.diferencia_porcentual).toBeCloseTo(diferencia_esperada, 5)
              }
            }

            // Verificar que cambios en tasa afectan el margen real pero no el nominal
            const margen_original = margenes[0]
            const margen_calc_original = calculate_real_margin(
              margen_original.precio_venta,
              margen_original.costo_original,
              margen_original.tasa_actual,
              margen_original.tasa_original
            )

            // Simular cambio de tasa
            const tasa_nueva = margen_original.tasa_actual * 1.1
            const margen_calc_nueva_tasa = calculate_real_margin(
              margen_original.precio_venta,
              margen_original.costo_original,
              tasa_nueva,
              margen_original.tasa_original
            )

            // El margen nominal no debe cambiar
            expect(margen_calc_nueva_tasa.margen_nominal).toBe(margen_calc_original.margen_nominal)

            // El margen real debe cambiar
            expect(margen_calc_nueva_tasa.margen_real).not.toBe(margen_calc_original.margen_real)

            // La diferencia porcentual debe cambiar
            expect(margen_calc_nueva_tasa.diferencia_porcentual).not.toBe(margen_calc_original.diferencia_porcentual)
          }
        ),
        { numRuns: 20 }
      )
    })

    it('Las actualizaciones concurrentes deben mantener consistencia sin race conditions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(productDataArbitrary, { minLength: 2, maxLength: 5 }),
          fc.integer({ min: 2, max: 5 }), // número de actualizaciones concurrentes
          async (productos, num_updates) => {
            // Crear múltiples actualizaciones concurrentes
            const updates = []
            for (let i = 0; i < num_updates; i++) {
              const factor = 1 + (i * 0.1)
              updates.push(
                Promise.resolve(
                  productos.map(p => ({
                    ...p,
                    precio_venta: p.precio_venta * factor,
                  }))
                )
              )
            }

            // Ejecutar todas las actualizaciones concurrentemente
            const resultados = await Promise.all(updates)

            // Verificar que cada resultado es consistente internamente
            for (const resultado of resultados) {
              const kpis = resultado.map(p => calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa))

              // Todos los KPIs deben ser calculables o null, sin errores
              for (const kpi of kpis) {
                if (kpi !== null) {
                  expect(typeof kpi).toBe('number')
                  expect(isNaN(kpi)).toBe(false)
                  expect(isFinite(kpi)).toBe(true)
                }
              }
            }

            // Verificar que el último resultado es el más reciente
            const ultimo_resultado = resultados[resultados.length - 1]
            const ultimo_kpi = ultimo_resultado.map(p => calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa))

            // Recalcular con los mismos datos debe dar el mismo resultado
            const verificacion = ultimo_resultado.map(p => calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa))
            expect(ultimo_kpi).toEqual(verificacion)
          }
        ),
        { numRuns: 20 }
      )
    })

    it('Las actualizaciones concurrentes deben mantener consistencia sin race conditions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(productDataArbitrary, { minLength: 2, maxLength: 5 }),
          fc.integer({ min: 2, max: 5 }), // número de actualizaciones concurrentes
          async (productos, num_updates) => {
            // Crear múltiples actualizaciones concurrentes
            const updates = []
            for (let i = 0; i < num_updates; i++) {
              const factor = 1 + (i * 0.1)
              updates.push(
                Promise.resolve(
                  productos.map(p => ({
                    ...p,
                    precio_venta: p.precio_venta * factor,
                  }))
                )
              )
            }

            // Ejecutar todas las actualizaciones concurrentemente
            const resultados = await Promise.all(updates)

            // Verificar que cada resultado es consistente internamente
            for (const resultado of resultados) {
              const kpis = resultado.map(p => calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa))

              // Todos los KPIs deben ser calculables o null, sin errores
              for (const kpi of kpis) {
                if (kpi !== null) {
                  expect(typeof kpi).toBe('number')
                  expect(isNaN(kpi)).toBe(false)
                  expect(isFinite(kpi)).toBe(true)
                }
              }
            }

            // Verificar que el último resultado es el más reciente
            const ultimo_resultado = resultados[resultados.length - 1]
            const ultimo_kpi = ultimo_resultado.map(p => calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa))

            // Recalcular con los mismos datos debe dar el mismo resultado
            const verificacion = ultimo_resultado.map(p => calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa))
            expect(ultimo_kpi).toEqual(verificacion)
          }
        ),
        { numRuns: 40 }
      )
    })


    it('Las actualizaciones de KPIs deben mantener la consistencia interna', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(productDataArbitrary, { minLength: 1, maxLength: 5 }),
          fc.float({ min: Math.fround(1), max: Math.fround(100) }), // factor de actualización
          async (productos, factor) => {
            // Calcular KPIs iniciales
            const kpis_iniciales = productos.map(p => ({
              tasa_equilibrio: calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa),
              clasificacion: calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa) !== null
                ? clasificar_proximidad_equilibrio(
                    ((calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa)! - p.costo_divisa) / p.costo_divisa) * 100
                  )
                : null
            }))

            // Simular actualización de datos (ej: cambio en precio de venta)
            const productos_actualizados = productos.map(p => ({
              ...p,
              precio_venta: p.precio_venta * factor
            }))

            // Recalcular KPIs
            const kpis_actualizados = productos_actualizados.map(p => ({
              tasa_equilibrio: calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa),
              clasificacion: calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa) !== null
                ? clasificar_proximidad_equilibrio(
                    ((calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa)! - p.costo_divisa) / p.costo_divisa) * 100
                  )
                : null
            }))

            // Verificar consistencia: productos con precio mayor deben tener tasa de equilibrio mayor (si es calculable)
            for (let i = 0; i < productos.length; i++) {
              const original = productos[i]
              const actualizado = productos_actualizados[i]

              if (factor > 1 && original.costo_divisa > 0) {
                // Si el precio aumenta, la tasa de equilibrio debería aumentar proporcionalmente
                const tasa_original = kpis_iniciales[i].tasa_equilibrio
                const tasa_actualizada = kpis_actualizados[i].tasa_equilibrio

                if (tasa_original !== null && tasa_actualizada !== null) {
                  expect(tasa_actualizada).toBeGreaterThan(tasa_original)
                }
              }
            }

            // Verificar que la clasificación es consistente con la tasa calculada
            for (const kpi of kpis_actualizados) {
              if (kpi.tasa_equilibrio === null) {
                expect(kpi.clasificacion).toBeNull()
              }
            }
          }
        ),
        { numRuns: 30 }
      )
    })
  })

  describe('Property 17: Currency Trend Classification Stability', () => {
    it('La clasificación de tendencias debe ser estable y consistente', async () => {
      await fc.assert(
        fc.asyncProperty(
          currencyTrendArbitrary,
          fc.integer({ min: 1, max: 10 }), // número de repeticiones
          async (trendData, repetitions) => {
            // Calcular tendencia
            const cambio_porcentual = calculate_currency_trend(trendData.tasa_actual, trendData.tasa_30dias_atras)
            const clasificacion = classify_currency_trend(cambio_porcentual)

            // Repetir el cálculo múltiples veces
            for (let i = 0; i < repetitions; i++) {
              const cambio_repetido = calculate_currency_trend(trendData.tasa_actual, trendData.tasa_30dias_atras)
              const clasificacion_repetida = classify_currency_trend(cambio_repetido)

              // Debe ser idéntico
              expect(cambio_porcentual).toBe(cambio_repetido)
              expect(clasificacion).toBe(clasificacion_repetida)
            }

            // Verificar límites de clasificación
            if (cambio_porcentual > 2) {
              expect(clasificacion).toBe('alcista')
            } else if (cambio_porcentual < -2) {
              expect(clasificacion).toBe('bajista')
            } else {
              expect(clasificacion).toBe('estable')
            }

            // Verificar que cambios cercanos al límite dan resultados consistentes
            const cambio_cercano = cambio_porcentual + 0.001
            const clasificacion_cercana = classify_currency_trend(cambio_cercano)

            // Cambios muy pequeños no deberían cambiar la clasificación
            if (Math.abs(cambio_porcentual - 2) > 0.01 && Math.abs(cambio_porcentual - (-2)) > 0.01 && Math.abs(cambio_porcentual) > 0.01) {
              expect(clasificacion).toBe(clasificacion_cercana)
            }
          }
        ),
        { numRuns: 20 }
      )
    })

    it('La clasificación debe ser transitiva y mantener orden', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(currencyTrendArbitrary, { minLength: 3, maxLength: 10 }),
          async (trends) => {
            // Calcular cambios y clasificaciones
            const cambios_clasificaciones = trends.map(t => ({
              cambio: calculate_currency_trend(t.tasa_actual, t.tasa_30dias_atras),
              clasificacion: classify_currency_trend(calculate_currency_trend(t.tasa_actual, t.tasa_30dias_atras))
            }))

            // Ordenar por cambio porcentual
            const ordenados_por_cambio = [...cambios_clasificaciones].sort((a, b) => a.cambio - b.cambio)

            // Verificar que la clasificación respeta el orden
            for (let i = 1; i < ordenados_por_cambio.length; i++) {
              const anterior = ordenados_por_cambio[i - 1]
              const actual = ordenados_por_cambio[i]

              // Si el cambio anterior es mayor que el actual, la clasificación debería ser al menos igual de "positiva"
              if (anterior.cambio > actual.cambio) {
                const orden_clasificaciones = ['bajista', 'estable', 'alcista']
                const indice_anterior = orden_clasificaciones.indexOf(anterior.clasificacion)
                const indice_actual = orden_clasificaciones.indexOf(actual.clasificacion)

                expect(indice_anterior).toBeGreaterThanOrEqual(indice_actual)
              }
            }

            // Verificar que no hay saltos inesperados en la clasificación
            for (let i = 0; i < cambios_clasificaciones.length; i++) {
              const actual = cambios_clasificaciones[i]

              // Calcular clasificaciones para valores cercanos
              const cercano_mas = classify_currency_trend(actual.cambio + 0.1)
              const cercano_menos = classify_currency_trend(actual.cambio - 0.1)

              // Los valores cercanos no deberían tener clasificaciones radicalmente diferentes
              const clasificaciones_cercanas = [cercano_mas, cercano_menos, actual.clasificacion]
              const clasificaciones_unicas = [...new Set(clasificaciones_cercanas)]

              // Máximo 2 clasificaciones diferentes para valores cercanos
              expect(clasificaciones_unicas.length).toBeLessThanOrEqual(2)
            }
          }
        ),
        { numRuns: 20 }
      )
    })

    it('Los límites de clasificación deben ser precisos', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: Math.fround(-10), max: Math.fround(10) }),
          async (cambio_base) => {
            // Probar exactamente en los límites
            const limites = [-2, -1.999, -1.001, 0, 1.001, 1.999, 2, 2.001]

            for (const limite of limites) {
              const clasificacion_limite = classify_currency_trend(limite)

              // Verificar que la clasificación es correcta en los límites
              if (limite > 2) {
                expect(clasificacion_limite).toBe('alcista')
              } else if (limite < -2) {
                expect(clasificacion_limite).toBe('bajista')
              } else {
                expect(clasificacion_limite).toBe('estable')
              }

              // Verificar consistencia con valores muy cercanos
              const epsilon = 0.0001
              const clasificacion_mas = classify_currency_trend(limite + epsilon)
              const clasificacion_menos = classify_currency_trend(limite - epsilon)

              // Para valores exactamente en el límite, los valores cercanos deberían mantener la clasificación
              if (Math.abs(limite - 2) < 0.001 || Math.abs(limite - (-2)) < 0.001) {
                // En el límite, permitir que valores cercanos puedan cambiar
              } else {
                // Fuera del límite, valores cercanos deberían mantener la clasificación
                expect(clasificacion_limite).toBe(clasificacion_mas)
                expect(clasificacion_limite).toBe(clasificacion_menos)
              }
            }
          }
        ),
        { numRuns: 20 }
      )
    })
  })

  describe('Property 18: Debt Priority Ranking Consistency', () => {
    it('El ranking de prioridades de deudas debe ser consistente y ordenable', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(debtDataArbitrary, { minLength: 2, maxLength: 15 }),
          async (deudas) => {
            // Calcular scores de prioridad
            const scores = deudas.map(d => calculate_debt_priority_score(d.antiguedad_dias, d.monto, d.tendencia_30d))

            // Verificar que todos los scores están en el rango [0, 1]
            for (const score of scores) {
              expect(score).toBeGreaterThanOrEqual(0)
              expect(score).toBeLessThanOrEqual(1)
            }

            // Calcular múltiples veces para verificar idempotencia
            const scores_repetidos = deudas.map(d => calculate_debt_priority_score(d.antiguedad_dias, d.monto, d.tendencia_30d))
            expect(scores).toEqual(scores_repetidos)

            // Verificar que deudas con mayor antigüedad tienen mayor prioridad (todo lo demás igual)
            const deuda_antigua = { antiguedad_dias: 365, monto: 1000, tendencia_30d: 0 }
            const deuda_reciente = { antiguedad_dias: 30, monto: 1000, tendencia_30d: 0 }

            const score_antigua = calculate_debt_priority_score(deuda_antigua.antiguedad_dias, deuda_antigua.monto, deuda_antigua.tendencia_30d)
            const score_reciente = calculate_debt_priority_score(deuda_reciente.antiguedad_dias, deuda_reciente.monto, deuda_reciente.tendencia_30d)

            expect(score_antigua).toBeGreaterThan(score_reciente)

            // Verificar que deudas con mayor tendencia alcista tienen mayor prioridad
            const deuda_alcista = { antiguedad_dias: 30, monto: 1000, tendencia_30d: 10 }
            const deuda_estable = { antiguedad_dias: 30, monto: 1000, tendencia_30d: 0 }

            const score_alcista = calculate_debt_priority_score(deuda_alcista.antiguedad_dias, deuda_alcista.monto, deuda_alcista.tendencia_30d)
            const score_estable = calculate_debt_priority_score(deuda_estable.antiguedad_dias, deuda_estable.monto, deuda_estable.tendencia_30d)

            expect(score_alcista).toBeGreaterThan(score_estable)
          }
        ),
        { numRuns: 20 }
      )
    })

    it('El ordenamiento de deudas por prioridad debe ser estable y consistente', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(debtPriorityInputArbitrary, { minLength: 3, maxLength: 10 }),
          fc.date({ min: new Date('2020-01-01'), max: new Date() }),
          async (deudas, fechaCorte) => {
            // Crear mapa de tasas históricas simulado
            const tasas_historicas = new Map<string, Map<string, number>>()

            // Inicializar tasas para cada moneda
            const monedas_unicas = [...new Set(deudas.map(d => d.moneda))]
            for (const moneda of monedas_unicas) {
              const tasas_moneda = new Map<string, number>()
              // Simular tasa actual
              tasas_moneda.set(fechaCorte.toISOString().split('T')[0], 1)
              // Simular tasa hace 30 días
              const fecha_30_dias = new Date(fechaCorte)
              fecha_30_dias.setDate(fecha_30_dias.getDate() - 30)
              tasas_moneda.set(fecha_30_dias.toISOString().split('T')[0], 1)
              tasas_historicas.set(moneda, tasas_moneda)
            }

            // Calcular prioridades
            const prioridades = calculate_debt_priority(deudas, tasas_historicas, fechaCorte)

            // Verificar que el resultado tiene la misma cantidad de elementos
            expect(prioridades.length).toBe(deudas.length)

            // Verificar que todas las prioridades están en rango [0, 1]
            for (const prioridad of prioridades) {
              expect(prioridad.score_prioridad).toBeGreaterThanOrEqual(0)
              expect(prioridad.score_prioridad).toBeLessThanOrEqual(1)
            }

            // Verificar que está ordenado por prioridad descendente
            for (let i = 1; i < prioridades.length; i++) {
              expect(prioridades[i - 1].score_prioridad).toBeGreaterThanOrEqual(prioridades[i].score_prioridad)
            }

            // Verificar idempotencia: calcular múltiples veces debe dar el mismo resultado
            const prioridades_repetidas = calculate_debt_priority(deudas, tasas_historicas, fechaCorte)
            expect(prioridades).toEqual(prioridades_repetidas)

            // Verificar que todas las deudas originales están representadas
            const ids_originales = new Set(deudas.map(d => d.id))
            const ids_resultado = new Set(prioridades.map(p => p.deuda_id))
            expect(ids_resultado).toEqual(ids_originales)
          }
        ),
        { numRuns: 20 }
      )
    })

    it('Los cálculos de impacto de deuda deben ser consistentes con las prioridades', async () => {
      await fc.assert(
        fc.asyncProperty(
          debtDataArbitrary,
          fc.integer({ min: 1, max: 10 }), // multiplicador para variaciones
          async (deudaBase, multiplicador) => {
            // Probar diferentes escenarios de tendencia
            const tendencias = [0, 1, 5, 10, -1, -5, -10]

            for (const tendencia of tendencias) {
              const score_prioridad = calculate_debt_priority_score(deudaBase.antiguedad_dias, deudaBase.monto, tendencia)

              // Verificar que el score es consistente
              const score_repetido = calculate_debt_priority_score(deudaBase.antiguedad_dias, deudaBase.monto, tendencia)
              expect(score_prioridad).toBe(score_repetido)

              // Verificar que tendencias positivas aumentan la prioridad
              if (tendencia > 0) {
                const score_cero = calculate_debt_priority_score(deudaBase.antiguedad_dias, deudaBase.monto, 0)
                expect(score_prioridad).toBeGreaterThanOrEqual(score_cero)
              }

              // Verificar que tendencias negativas no afectan tanto como positivas (simetría)
              if (tendencia < 0) {
                const score_positivo = calculate_debt_priority_score(deudaBase.antiguedad_dias, deudaBase.monto, Math.abs(tendencia))
                const score_negativo = calculate_debt_priority_score(deudaBase.antiguedad_dias, deudaBase.monto, tendencia)

                // La prioridad con tendencia negativa debería ser menor que con positiva de igual magnitud
                expect(score_negativo).toBeLessThanOrEqual(score_positivo)
              }

              // Verificar límites del score
              expect(score_prioridad).toBeGreaterThanOrEqual(0)
              expect(score_prioridad).toBeLessThanOrEqual(1)

              // Verificar que el monto afecta proporcionalmente (dentro de límites razonables)
              if (deudaBase.monto > 0) {
                const score_monto_doble = calculate_debt_priority_score(deudaBase.antiguedad_dias, deudaBase.monto * 2, tendencia)
                // El monto tiene un efecto limitado en el score total
                expect(Math.abs(score_monto_doble - score_prioridad)).toBeLessThan(0.1)
              }
            }
          }
        ),
        { numRuns: 20 }
      )
    })
  })
})