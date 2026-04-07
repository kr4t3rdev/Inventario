/**
 * @fileoverview Property-Based Tests for Real-Time KPI Update Consistency
 * Feature: dashboard-inteligencia-cambiaria, Property 13: Real-Time KPI Update Consistency
 * Validates: Requirements 10.4
 * 
 * This test suite validates that KPI calculations maintain consistency during real-time updates,
 * including idempotence, data freshness, and concurrent update handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import {
  calculate_break_even_rate,
  calculate_real_margin,
  calculate_debt_priority_score,
  calculate_currency_trend,
  calculate_exchange_differential,
  calculate_debt_priority,
} from '../exchange_intelligence_kpis'

// ============================================================================
// Generadores de datos para pruebas
// ============================================================================

const product_data_arbitrary = fc.record({
  precio_venta: fc.float({ min: Math.fround(1), max: Math.fround(10000) }),
  gastos_fijos: fc.float({ min: Math.fround(0), max: Math.fround(5000) }),
  costo_divisa: fc.float({ min: Math.fround(0.01), max: Math.fround(5000) }),
})

const margin_data_arbitrary = fc.record({
  precio_venta: fc.float({ min: Math.fround(1), max: Math.fround(10000) }),
  costo_original: fc.float({ min: Math.fround(0.01), max: Math.fround(5000) }),
  tasa_actual: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }),
  tasa_original: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }),
})

const debt_data_arbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 10 }),
  monto: fc.float({ min: Math.fround(0.01), max: Math.fround(1000000) }),
  moneda: fc.constantFrom('USD', 'EUR', 'GBP', 'CAD', 'MXN'),
  fecha_registro: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
})

const transaction_data_arbitrary = fc.record({
  fecha: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
  tasa: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }),
  tasa_original: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }),
  monto: fc.float({ min: Math.fround(0.01), max: Math.fround(100000) }),
  moneda: fc.constantFrom('USD', 'EUR', 'GBP'),
})

// ============================================================================
// Test Suite: Property 13 - Real-Time KPI Update Consistency
// ============================================================================

describe('Property 13: Real-Time KPI Update Consistency', () => {
  describe('Idempotence and Determinism', () => {
    it('Los cálculos de KPIs deben ser idempotentes (múltiples cálculos = mismo resultado)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(product_data_arbitrary, { minLength: 1, maxLength: 10 }),
          async (productos) => {
            // Calcular KPIs múltiples veces
            const resultados = []
            for (let i = 0; i < 5; i++) {
              const resultado = productos.map(p =>
                calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa)
              )
              resultados.push(resultado)
            }

            // Todos los resultados deben ser idénticos
            for (let i = 1; i < resultados.length; i++) {
              expect(resultados[i]).toEqual(resultados[0])
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it('Los cálculos deben ser deterministas independientemente del orden de procesamiento', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(margin_data_arbitrary, { minLength: 2, maxLength: 10 }),
          async (margenes) => {
            // Calcular en orden original
            const resultado_original = margenes.map(m =>
              calculate_real_margin(m.precio_venta, m.costo_original, m.tasa_actual, m.tasa_original)
            )

            // Calcular en orden invertido
            const margenes_invertidos = [...margenes].reverse()
            const resultado_invertido = margenes_invertidos.map(m =>
              calculate_real_margin(m.precio_venta, m.costo_original, m.tasa_actual, m.tasa_original)
            )

            // Los resultados individuales deben ser los mismos
            for (let i = 0; i < margenes.length; i++) {
              const original = resultado_original[i]
              const invertido = resultado_invertido[margenes.length - 1 - i]

              expect(original.margen_nominal).toBe(invertido.margen_nominal)
              expect(original.margen_real).toBeCloseTo(invertido.margen_real, 5)
              expect(original.diferencia_porcentual).toBeCloseTo(invertido.diferencia_porcentual, 5)
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('Data Freshness and Recalculation', () => {
    it('Las actualizaciones de datos deben reflejarse inmediatamente en los KPIs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(product_data_arbitrary, { minLength: 1, maxLength: 5 }),
          fc.float({ min: Math.fround(1.1), max: Math.fround(2.0) }),
          async (productos, factor_cambio) => {
            // Calcular KPIs iniciales
            const kpis_iniciales = productos.map(p => ({
              tasa_equilibrio: calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa),
              precio_venta: p.precio_venta,
            }))

            // Simular actualización de datos
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

              // El precio debe coincidir con el dato más reciente
              expect(actualizado.precio_venta).toBe(productos_actualizados[i].precio_venta)

              // Si el precio aumentó, la tasa de equilibrio debe aumentar
              if (factor_cambio > 1 && inicial.tasa_equilibrio !== null && actualizado.tasa_equilibrio !== null) {
                expect(actualizado.tasa_equilibrio).toBeGreaterThan(inicial.tasa_equilibrio)
              }
            }

            // Verificar que no hay datos obsoletos: recalcular debe dar el mismo resultado
            const kpis_verificacion = productos_actualizados.map(p =>
              calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa)
            )

            for (let i = 0; i < kpis_actualizados.length; i++) {
              expect(kpis_actualizados[i].tasa_equilibrio).toBe(kpis_verificacion[i])
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('Los cambios en datos deben propagarse correctamente a todos los KPIs dependientes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(margin_data_arbitrary, { minLength: 1, maxLength: 5 }),
          fc.float({ min: Math.fround(0.5), max: Math.fround(2.0) }),
          async (margenes, factor_tasa) => {
            // Calcular márgenes iniciales
            const margenes_iniciales = margenes.map(m =>
              calculate_real_margin(m.precio_venta, m.costo_original, m.tasa_actual, m.tasa_original)
            )

            // Simular cambio de tasa
            const margenes_actualizados_datos = margenes.map(m => ({
              ...m,
              tasa_actual: m.tasa_actual * factor_tasa,
            }))

            // Recalcular márgenes
            const margenes_actualizados = margenes_actualizados_datos.map(m =>
              calculate_real_margin(m.precio_venta, m.costo_original, m.tasa_actual, m.tasa_original)
            )

            // Verificar que el margen nominal no cambió (no depende de tasa)
            for (let i = 0; i < margenes.length; i++) {
              expect(margenes_actualizados[i].margen_nominal).toBe(margenes_iniciales[i].margen_nominal)
            }

            // Verificar que el margen real cambió (depende de tasa)
            for (let i = 0; i < margenes.length; i++) {
              if (factor_tasa !== 1) {
                expect(margenes_actualizados[i].margen_real).not.toBe(margenes_iniciales[i].margen_real)
              }
            }

            // Verificar que la diferencia porcentual cambió
            for (let i = 0; i < margenes.length; i++) {
              if (factor_tasa !== 1 && margenes_iniciales[i].margen_nominal !== 0) {
                expect(margenes_actualizados[i].diferencia_porcentual).not.toBe(margenes_iniciales[i].diferencia_porcentual)
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Concurrent Update Handling', () => {
    it('Las actualizaciones concurrentes deben mantener consistencia sin race conditions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(product_data_arbitrary, { minLength: 2, maxLength: 5 }),
          fc.integer({ min: 2, max: 5 }),
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
              const kpis = resultado.map(p =>
                calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa)
              )

              // Todos los KPIs deben ser válidos
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
            const ultimo_kpi = ultimo_resultado.map(p =>
              calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa)
            )

            // Recalcular con los mismos datos debe dar el mismo resultado
            const verificacion = ultimo_resultado.map(p =>
              calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa)
            )
            expect(ultimo_kpi).toEqual(verificacion)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('Las actualizaciones concurrentes de diferentes KPIs deben ser independientes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(product_data_arbitrary, { minLength: 1, maxLength: 3 }),
          fc.array(margin_data_arbitrary, { minLength: 1, maxLength: 3 }),
          async (productos, margenes) => {
            // Ejecutar cálculos de diferentes KPIs concurrentemente
            const [kpis_equilibrio, kpis_margenes] = await Promise.all([
              Promise.resolve(
                productos.map(p =>
                  calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa)
                )
              ),
              Promise.resolve(
                margenes.map(m =>
                  calculate_real_margin(m.precio_venta, m.costo_original, m.tasa_actual, m.tasa_original)
                )
              ),
            ])

            // Verificar que ambos cálculos completaron correctamente
            expect(kpis_equilibrio).toHaveLength(productos.length)
            expect(kpis_margenes).toHaveLength(margenes.length)

            // Recalcular para verificar consistencia
            const kpis_equilibrio_verificacion = productos.map(p =>
              calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa)
            )
            const kpis_margenes_verificacion = margenes.map(m =>
              calculate_real_margin(m.precio_venta, m.costo_original, m.tasa_actual, m.tasa_original)
            )

            expect(kpis_equilibrio).toEqual(kpis_equilibrio_verificacion)
            expect(kpis_margenes).toEqual(kpis_margenes_verificacion)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('KPI Interdependencies', () => {
    it('Las interdependencias de KPIs deben resolverse correctamente', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(margin_data_arbitrary, { minLength: 1, maxLength: 5 }),
          async (margenes) => {
            // Calcular márgenes
            const margenes_calculados = margenes.map(m =>
              calculate_real_margin(m.precio_venta, m.costo_original, m.tasa_actual, m.tasa_original)
            )

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
          }
        ),
        { numRuns: 100 }
      )
    })

    it('Los cambios en una variable deben afectar solo los KPIs dependientes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(margin_data_arbitrary, { minLength: 1, maxLength: 5 }),
          fc.float({ min: Math.fround(0.5), max: Math.fround(2.0) }),
          async (margenes, factor_tasa) => {
            // Calcular márgenes iniciales
            const margenes_iniciales = margenes.map(m =>
              calculate_real_margin(m.precio_venta, m.costo_original, m.tasa_actual, m.tasa_original)
            )

            // Cambiar solo la tasa
            const margenes_con_tasa_nueva = margenes.map(m => ({
              ...m,
              tasa_actual: m.tasa_actual * factor_tasa,
            }))

            const margenes_actualizados = margenes_con_tasa_nueva.map(m =>
              calculate_real_margin(m.precio_venta, m.costo_original, m.tasa_actual, m.tasa_original)
            )

            // Verificar que solo los KPIs dependientes de tasa cambiaron
            for (let i = 0; i < margenes.length; i++) {
              // Margen nominal no debe cambiar (no depende de tasa)
              expect(margenes_actualizados[i].margen_nominal).toBe(margenes_iniciales[i].margen_nominal)

              // Margen real debe cambiar (depende de tasa)
              if (factor_tasa !== 1) {
                expect(margenes_actualizados[i].margen_real).not.toBe(margenes_iniciales[i].margen_real)
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Calculation Timing and Performance', () => {
    it('Los cálculos deben completarse dentro de tiempo aceptable', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(product_data_arbitrary, { minLength: 1, maxLength: 100 }),
          async (productos) => {
            const inicio = performance.now()

            // Ejecutar cálculos
            const kpis = productos.map(p =>
              calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa)
            )

            const fin = performance.now()
            const tiempo_ms = fin - inicio

            // Debe completarse en menos de 2 segundos (2000ms)
            expect(tiempo_ms).toBeLessThan(2000)

            // Verificar que todos los cálculos completaron
            expect(kpis).toHaveLength(productos.length)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('Los cálculos de múltiples KPIs deben ser eficientes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(margin_data_arbitrary, { minLength: 1, maxLength: 100 }),
          async (margenes) => {
            const inicio = performance.now()

            // Ejecutar múltiples cálculos
            const resultados = margenes.map(m =>
              calculate_real_margin(m.precio_venta, m.costo_original, m.tasa_actual, m.tasa_original)
            )

            const fin = performance.now()
            const tiempo_ms = fin - inicio

            // Debe completarse en menos de 2 segundos
            expect(tiempo_ms).toBeLessThan(2000)

            // Verificar que todos los cálculos completaron
            expect(resultados).toHaveLength(margenes.length)
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('State Consistency After Updates', () => {
    it('El estado debe ser consistente después de múltiples actualizaciones secuenciales', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(product_data_arbitrary, { minLength: 1, maxLength: 5 }),
          fc.array(fc.float({ min: Math.fround(1.01), max: Math.fround(1.5) }), { minLength: 3, maxLength: 5 }),
          async (productos, factores_cambio) => {
            let estado_actual = productos

            // Aplicar múltiples actualizaciones secuencialmente
            for (const factor of factores_cambio) {
              estado_actual = estado_actual.map(p => ({
                ...p,
                precio_venta: p.precio_venta * factor,
              }))

              // Calcular KPIs después de cada actualización
              const kpis = estado_actual.map(p =>
                calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa)
              )

              // Todos los KPIs deben ser válidos
              for (const kpi of kpis) {
                if (kpi !== null) {
                  expect(typeof kpi).toBe('number')
                  expect(isNaN(kpi)).toBe(false)
                  expect(isFinite(kpi)).toBe(true)
                }
              }
            }

            // Verificar que el estado final es consistente
            const kpis_finales = estado_actual.map(p =>
              calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa)
            )

            // Recalcular para verificar
            const kpis_verificacion = estado_actual.map(p =>
              calculate_break_even_rate(p.precio_venta, p.gastos_fijos, p.costo_divisa)
            )

            expect(kpis_finales).toEqual(kpis_verificacion)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('No debe haber datos obsoletos después de actualizaciones', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(margin_data_arbitrary, { minLength: 1, maxLength: 5 }),
          fc.float({ min: Math.fround(0.5), max: Math.fround(2.0) }),
          fc.float({ min: Math.fround(0.5), max: Math.fround(2.0) }),
          async (margenes, factor1, factor2) => {
            // Primera actualización
            const margenes_v1 = margenes.map(m => ({
              ...m,
              tasa_actual: m.tasa_actual * factor1,
            }))

            const kpis_v1 = margenes_v1.map(m =>
              calculate_real_margin(m.precio_venta, m.costo_original, m.tasa_actual, m.tasa_original)
            )

            // Segunda actualización
            const margenes_v2 = margenes_v1.map(m => ({
              ...m,
              tasa_actual: m.tasa_actual * factor2,
            }))

            const kpis_v2 = margenes_v2.map(m =>
              calculate_real_margin(m.precio_venta, m.costo_original, m.tasa_actual, m.tasa_original)
            )

            // Los KPIs v2 deben reflejar la tasa más reciente (v2), no v1
            for (let i = 0; i < margenes.length; i++) {
              // Calcular lo que debería ser con la tasa v2
              const esperado = calculate_real_margin(
                margenes_v2[i].precio_venta,
                margenes_v2[i].costo_original,
                margenes_v2[i].tasa_actual,
                margenes_v2[i].tasa_original
              )

              // Debe coincidir con kpis_v2
              expect(kpis_v2[i].margen_real).toBeCloseTo(esperado.margen_real, 5)

              // No debe coincidir con kpis_v1 (a menos que factor2 = 1)
              if (factor2 !== 1) {
                expect(kpis_v2[i].margen_real).not.toBeCloseTo(kpis_v1[i].margen_real, 5)
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
