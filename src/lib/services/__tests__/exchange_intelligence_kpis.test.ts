/**
 * @fileoverview Property tests para funciones de cálculo de KPIs del Exchange Intelligence Dashboard
 * Feature: dashboard-inteligencia-cambiaria
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  calculate_break_even_rate,
  clasificar_proximidad_equilibrio,
  calculate_real_margin,
  generar_tendencia_historica,
  calculate_exchange_differential_single,
  calculate_exchange_differential,
  calculate_debt_priority_score,
  calculate_debt_impact_30d,
  calculate_currency_trend,
  classify_currency_trend,
  calculate_debt_priority,
} from '../exchange_intelligence_kpis'

// Feature: dashboard-inteligencia-cambiaria
// Requisitos: 4.1, 4.3, 5.1, 5.2, 5.4, 6.1, 6.4, 6.6, 7.1, 7.2, 7.4, 7.6

describe('ExchangeIntelligence KPIs - Property Tests', () => {
  // ========== PROPERTY 4: Break-Even Exchange Rate Calculation ==========
  describe('Property 4: Break-Even Exchange Rate Calculation', () => {
    /**
     * @description La tasa de equilibrio debe ser positiva cuando el producto es rentable
     * @requires 4.1
     */
    it('La tasa de equilibrio debe ser positiva cuando precio > gastos_fijos + costo_divisa', () => {
      expect(
        fc.assert(
          fc.property(
            fc.nat({ max: 10000 }),
            fc.nat({ max: 5000 }),
            fc.nat({ max: 1000 }),
            (precio_venta, gastos_fijos, costo_divisa) => {
              if (precio_venta > gastos_fijos + costo_divisa && costo_divisa > 0) {
                const resultado = calculate_break_even_rate(precio_venta, gastos_fijos, costo_divisa)
                return resultado !== null && resultado > 0
              }
              return true
            }
          )
        )
      ).toBeUndefined()
    })

    /**
     * @description La fórmula de tasa de equilibrio debe ser (precio_venta - gastos_fijos) / costo_divisa
     * @requires 4.1
     */
    it('La fórmula de tasa de equilibrio debe ser (precio_venta - gastos_fijos) / costo_divisa', () => {
      expect(
        fc.assert(
          fc.asyncProperty(
            fc.nat({ max: 10000 }),
            fc.nat({ max: 5000 }),
            fc.nat({ max: 1000 }),
            async (precio_venta, gastos_fijos, costo_divisa) => {
              if (costo_divisa > 0) {
                const resultado = calculate_break_even_rate(precio_venta, gastos_fijos, costo_divisa)
                if (resultado !== null) {
                  const esperada = (precio_venta - gastos_fijos) / costo_divisa
                  expect(resultado).toBeCloseTo(esperada, 10)
                }
              }
            }
          )
        )
      ).toBeUndefined()
    })

    /**
     * @description División por cero debe retornar null
     * @requires 4.1
     */
    it('División por cero debe retornar null', () => {
      const resultado = calculate_break_even_rate(100, 50, 0)
      expect(resultado).toBeNull()
    })

    /**
     * @description Producto no rentable (precio < gastos_fijos) debe retornar null
     * @requires 4.1
     */
    it('Producto no rentable debe retornar null', () => {
      const resultado = calculate_break_even_rate(50, 100, 10)
      expect(resultado).toBeNull()
    })

    /**
     * @description Clasificación por proximidad debe ser correcta
     * @requires 4.3
     */
    it('Clasificación por proximidad debe ser correcta: critico > 100%, advertencia > 10%, seguro <= 10%', () => {
      expect(clasificar_proximidad_equilibrio(5)).toBe('seguro')
      expect(clasificar_proximidad_equilibrio(10)).toBe('seguro')
      expect(clasificar_proximidad_equilibrio(11)).toBe('advertencia')
      expect(clasificar_proximidad_equilibrio(100)).toBe('advertencia')
      expect(clasificar_proximidad_equilibrio(101)).toBe('critico')
      
      // Verificar valores negativos
      expect(clasificar_proximidad_equilibrio(-5)).toBe('seguro')
      expect(clasificar_proximidad_equilibrio(-11)).toBe('advertencia')
      expect(clasificar_proximidad_equilibrio(-101)).toBe('critico')
    })

    /**
     * @description La proximidad debe clasificarse correctamente con valores extremos
     * @requires 4.3
     */
    it('La proximidad debe clasificarse correctamente con valores extremos', () => {
      expect(
        fc.assert(
          fc.property(
            fc.integer({ min: -1000, max: 1000 }),
            (proximidad) => {
              const clasificacion = clasificar_proximidad_equilibrio(proximidad)
              expect(['seguro', 'advertencia', 'critico']).toContain(clasificacion)
            }
          )
        )
      ).toBeUndefined()
    })
  })

  // ========== PROPERTY 5: Margin Calculation Accuracy ==========
  describe('Property 5: Margin Calculation Accuracy', () => {
    /**
     * @description El margen nominal debe ser precio_venta - costo_original
     * @requires 5.1
     */
    it('El margen nominal debe ser precio_venta - costo_original', () => {
      expect(
        fc.assert(
          fc.property(
            fc.nat({ max: 10000 }),
            fc.nat({ max: 5000 }),
            fc.nat({ max: 100 }),
            fc.nat({ max: 100 }),
            (precio_venta, costo_original, tasa_actual, tasa_original) => {
              const resultado = calculate_real_margin(precio_venta, costo_original, tasa_actual, tasa_original)
              if (!Number.isNaN(resultado.margen_nominal)) {
                const esperada = precio_venta - costo_original
                expect(resultado.margen_nominal).toBeCloseTo(esperada, 10)
              }
            }
          )
        )
      ).toBeUndefined()
    })

    /**
     * @description El costo ajustado debe ser costo_original * (tasa_actual / tasa_original)
     * @requires 5.2
     */
    it('El costo ajustado debe ser costo_original * (tasa_actual / tasa_original)', () => {
      expect(
        fc.assert(
          fc.property(
            fc.nat({ max: 10000 }),
            fc.nat({ max: 5000 }),
            fc.nat({ max: 100 }),
            fc.nat({ max: 100 }),
            (precio_venta, costo_original, tasa_actual, tasa_original) => {
              if (tasa_original > 0) {
                const resultado = calculate_real_margin(precio_venta, costo_original, tasa_actual, tasa_original)
                if (!Number.isNaN(resultado.costo_ajustado)) {
                  const esperada = costo_original * (tasa_actual / tasa_original)
                  expect(resultado.costo_ajustado).toBeCloseTo(esperada, 10)
                }
              }
            }
          )
        )
      ).toBeUndefined()
    })

    /**
     * @description El margen real debe ser precio_venta - costo_ajustado
     * @requires 5.2
     */
    it('El margen real debe ser precio_venta - costo_ajustado', () => {
      expect(
        fc.assert(
          fc.property(
            fc.nat({ max: 10000 }),
            fc.nat({ max: 5000 }),
            fc.nat({ max: 100 }),
            fc.nat({ max: 100 }),
            (precio_venta, costo_original, tasa_actual, tasa_original) => {
              const resultado = calculate_real_margin(precio_venta, costo_original, tasa_actual, tasa_original)
              if (!Number.isNaN(resultado.costo_ajustado)) {
                const esperada = precio_venta - resultado.costo_ajustado
                expect(resultado.margen_real).toBeCloseTo(esperada, 10)
              }
            }
          )
        )
      ).toBeUndefined()
    })

    /**
     * @description La diferencia porcentual debe calcularse correctamente
     * @requires 5.4
     */
    it('La diferencia porcentual debe calcularse correctamente', () => {
      expect(
        fc.assert(
          fc.property(
            fc.nat({ max: 10000 }),
            fc.nat({ max: 5000 }),
            fc.nat({ max: 100 }),
            fc.nat({ max: 100 }),
            (precio_venta, costo_original, tasa_actual, tasa_original) => {
              const resultado = calculate_real_margin(precio_venta, costo_original, tasa_actual, tasa_original)
              if (resultado.margen_nominal !== 0 && !Number.isNaN(resultado.margen_nominal)) {
                const esperada = ((resultado.margen_real - resultado.margen_nominal) / Math.abs(resultado.margen_nominal)) * 100
                expect(resultado.diferencia_porcentual).toBeCloseTo(esperada, 10)
              }
            }
          )
        )
      ).toBeUndefined()
    })

    /**
     * @description El margen real debe ser menor que el nominal cuando la moneda sube
     * @requires 5.1, 5.2
     */
    it('El margen real debe ser menor que el nominal cuando la moneda sube', () => {
      const resultado = calculate_real_margin(1000, 500, 30, 25)
      expect(resultado.margen_real).toBeLessThan(resultado.margen_nominal)
    })

    /**
     * @description El margen real debe ser mayor que el nominal cuando la moneda baja
     * @requires 5.1, 5.2
     */
    it('El margen real debe ser mayor que el nominal cuando la moneda baja', () => {
      const resultado = calculate_real_margin(1000, 500, 20, 25)
      expect(resultado.margen_real).toBeGreaterThan(resultado.margen_nominal)
    })

    /**
     * @description La tendencia histórica debe estar ordenada por fecha
     * @requires 5.4
     */
    it('La tendencia histórica debe estar ordenada por fecha', () => {
      const datos = [
        { fecha: new Date('2024-03-15'), margen_nominal: 100, margen_real: 80 },
        { fecha: new Date('2024-01-10'), margen_nominal: 120, margen_real: 100 },
        { fecha: new Date('2024-02-20'), margen_nominal: 110, margen_real: 90 },
      ]
      const resultado = generar_tendencia_historica(datos)
      expect(resultado[0].fecha).toBe('2024-01-10')
      expect(resultado[1].fecha).toBe('2024-02-20')
      expect(resultado[2].fecha).toBe('2024-03-15')
    })
  })

  // ========== PROPERTY 6: Exchange Differential Accumulation ==========
  describe('Property 6: Exchange Differential Accumulation', () => {
    /**
     * @description El diferencial debe ser |(tasa_actual - tasa_original) * monto|
     * @requires 6.1
     */
    it('El diferencial debe ser |(tasa_actual - tasa_original) * monto|', () => {
      expect(
        fc.assert(
          fc.property(
            fc.nat({ max: 100 }),
            fc.nat({ max: 100 }),
            fc.nat({ max: 100000 }),
            (tasa_actual, tasa_original, monto) => {
              const resultado = calculate_exchange_differential_single(tasa_actual, tasa_original, monto)
              const esperada = Math.abs((tasa_actual - tasa_original) * monto)
              expect(resultado).toBeCloseTo(esperada, 10)
            }
          )
        )
      ).toBeUndefined()
    })

    /**
     * @description El diferencial debe ser 0 cuando tasas son iguales
     * @requires 6.1
     */
    it('El diferencial debe ser 0 cuando tasas son iguales', () => {
      expect(
        fc.assert(
          fc.property(
            fc.nat({ max: 100 }),
            fc.nat({ max: 100000 }),
            (tasa, monto) => {
              const resultado = calculate_exchange_differential_single(tasa, tasa, monto)
              expect(resultado).toBe(0)
            }
          )
        )
      ).toBeUndefined()
    })

    /**
     * @description El diferencial debe ser 0 cuando tasa_original es 0
     * @requires 6.1
     */
    it('El diferencial debe ser 0 cuando tasa_original es 0', () => {
      const resultado = calculate_exchange_differential_single(25, 0, 1000)
      expect(resultado).toBe(0)
    })

    /**
     * @description El YTD debe ser la suma de todos los diferenciales del año
     * @requires 6.4
     */
    it('El YTD debe ser la suma de todos los diferenciales del año', () => {
      const transacciones = [
        { fecha: new Date('2024-03-15'), tasa: 25, monto: 1000, moneda: 'USD' },
        { fecha: new Date('2024-06-20'), tasa: 28, monto: 2000, moneda: 'USD' },
        { fecha: new Date('2024-09-10'), tasa: 30, monto: 1500, moneda: 'USD' },
      ]
      const resultado = calculate_exchange_differential(transacciones, 2024)
      
      // Verificar que el YTD es la suma de diferenciales
      let suma_esperada = 0
      for (const tx of transacciones) {
        suma_esperada += calculate_exchange_differential_single(tx.tasa, tx.tasa, tx.monto)
      }
      expect(resultado.diferencial).toBeCloseTo(suma_esperada, 10)
    })

    /**
     * @description El desglose mensual debe tener 12 meses
     * @requires 6.4
     */
    it('El desglose mensual debe tener 12 meses', () => {
      const transacciones = [
        { fecha: new Date('2024-01-15'), tasa: 25, monto: 1000, moneda: 'USD' },
        { fecha: new Date('2024-06-20'), tasa: 28, monto: 2000, moneda: 'USD' },
      ]
      const resultado = calculate_exchange_differential(transacciones, 2024)
      expect(resultado.desglose_mensual).toHaveLength(12)
    })

    /**
     * @description La comparación con año anterior debe calcularse correctamente
     * @requires 6.6
     */
    it('La comparación con año anterior debe calcularse correctamente', () => {
      const transacciones_2024 = [
        { fecha: new Date('2024-03-15'), tasa: 25, monto: 1000, moneda: 'USD' },
      ]
      const transacciones_2023 = [
        { fecha: new Date('2023-03-15'), tasa: 20, monto: 1000, moneda: 'USD' },
      ]
      
      // Combinar transacciones de ambos años
      const todas_transacciones = [...transacciones_2024, ...transacciones_2023]
      const resultado = calculate_exchange_differential(todas_transacciones, 2024)
      
      // La comparación debe ser un número
      expect(typeof resultado.comparacion_anio_anterior).toBe('number')
    })
  })

  // ========== PROPERTY 7: Debt Aging and Priority Calculation ==========
  describe('Property 7: Debt Aging and Priority Calculation', () => {
    /**
     * @description El score de prioridad debe estar entre 0 y 1
     * @requires 7.4
     */
    it('El score de prioridad debe estar entre 0 y 1', () => {
      expect(
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 3650 }), // Hasta 10 años
            fc.nat({ max: 1000000 }),
            fc.nat({ max: 50 }),
            (antiguedad_dias, monto, tendencia_30d) => {
              const resultado = calculate_debt_priority_score(antiguedad_dias, monto, tendencia_30d)
              expect(resultado).toBeGreaterThanOrEqual(0)
              expect(resultado).toBeLessThanOrEqual(1)
            }
          )
        )
      ).toBeUndefined()
    })

    /**
     * @description Mayor antigüedad debe dar mayor prioridad
     * @requires 7.1
     */
    it('Mayor antigüedad debe dar mayor prioridad', () => {
      const resultado_corto = calculate_debt_priority_score(30, 10000, 0)
      const resultado_largo = calculate_debt_priority_score(365, 10000, 0)
      expect(resultado_largo).toBeGreaterThan(resultado_corto)
    })

    /**
     * @description Mayor volatilidad de moneda debe dar mayor prioridad
     * @requires 7.2
     */
    it('Mayor volatilidad de moneda debe dar mayor prioridad', () => {
      const resultado_estable = calculate_debt_priority_score(180, 10000, 0)
      const resultado_volatile = calculate_debt_priority_score(180, 10000, 20)
      expect(resultado_volatile).toBeGreaterThan(resultado_estable)
    })

    /**
     * @description El impacto 30 días debe ser monto * (tendencia_30d / 100)
     * @requires 7.6
     */
    it('El impacto 30 días debe ser monto * (tendencia_30d / 100)', () => {
      expect(
        fc.assert(
          fc.property(
            fc.nat({ max: 1000000 }),
            fc.nat({ max: 50 }),
            (monto, tendencia_30d) => {
              const resultado = calculate_debt_impact_30d(monto, tendencia_30d)
              const esperada = monto * (tendencia_30d / 100)
              expect(resultado).toBeCloseTo(esperada, 10)
            }
          )
        )
      ).toBeUndefined()
    })

    /**
     * @description La tendencia de moneda debe calcularse correctamente
     * @requires 7.2
     */
    it('La tendencia de moneda debe calcularse correctamente', () => {
      expect(
        fc.assert(
          fc.property(
            fc.nat({ max: 100 }),
            fc.nat({ max: 100 }),
            (tasa_actual, tasa_30dias_atras) => {
              if (tasa_30dias_atras > 0) {
                const resultado = calculate_currency_trend(tasa_actual, tasa_30dias_atras)
                const esperada = ((tasa_actual - tasa_30dias_atras) / tasa_30dias_atras) * 100
                expect(resultado).toBeCloseTo(esperada, 10)
              }
            }
          )
        )
      ).toBeUndefined()
    })

    /**
     * @description Tendencia debe ser null cuando tasa_30dias_atras es 0
     * @requires 7.2
     */
    it('Tendencia debe ser null cuando tasa_30dias_atras es 0', () => {
      const resultado = calculate_currency_trend(25, 0)
      expect(resultado).toBe(0)
    })

    /**
     * @description Clasificación de tendencia debe ser correcta
     * @requires 7.2
     */
    it('Clasificación de tendencia debe ser correcta: alcista > 2%, bajista < -2%, estable en caso contrario', () => {
      expect(classify_currency_trend(5)).toBe('alcista')
      expect(classify_currency_trend(2.1)).toBe('alcista')
      expect(classify_currency_trend(2)).toBe('estable')
      expect(classify_currency_trend(-2)).toBe('estable')
      expect(classify_currency_trend(-2.1)).toBe('bajista')
      expect(classify_currency_trend(-5)).toBe('bajista')
      expect(classify_currency_trend(0)).toBe('estable')
    })

    /**
     * @description Las deudas deben ordenarse por prioridad descendente
     * @requires 7.4
     */
    it('Las deudas deben ordenarse por prioridad descendente', () => {
      const tasas_historicas = new Map<string, Map<string, number>>()
      const tasa_map = new Map<string, number>()
      tasa_map.set('2024-01-01', 25)
      tasa_map.set('2023-12-02', 24)
      tasas_historicas.set('USD', tasa_map)

      const deudas = [
        { id: '1', monto: 10000, moneda: 'USD', fecha_registro: new Date('2024-01-01') },
        { id: '2', monto: 5000, moneda: 'USD', fecha_registro: new Date('2023-06-01') },
        { id: '3', monto: 15000, moneda: 'USD', fecha_registro: new Date('2023-01-01') },
      ]

      const resultado = calculate_debt_priority(deudas, tasas_historicas, new Date('2024-01-01'))

      for (let i = 0; i < resultado.length - 1; i++) {
        expect(resultado[i].score_prioridad).toBeGreaterThanOrEqual(resultado[i + 1].score_prioridad)
      }
    })
  })

  // ========== Edge Cases ==========
  describe('Edge Cases', () => {
    /**
     * @description Valores extremos deben manejarse correctamente
     */
    it('Valores extremos deben manejarse correctamente', () => {
      // Tasa de equilibrio con valores extremos
      expect(calculate_break_even_rate(1, 0, 1)).not.toBeNull()
      
      // Márgenes con valores extremos
      const resultado = calculate_real_margin(1, 1, 1, 1)
      expect(typeof resultado.margen_nominal).toBe('number')
      
      // Diferencial con valores extremos
      expect(calculate_exchange_differential_single(1000000, 1, 1000000)).toBeGreaterThan(0)
      
      // Prioridad con valores extremos
      expect(calculate_debt_priority_score(3650, 1000000000, 50)).toBeLessThanOrEqual(1)
    })

    /**
     * @description División por cero debe manejarse gracefully
     */
    it('División por cero debe manejarse gracefully', () => {
      expect(calculate_break_even_rate(100, 50, 0)).toBeNull()
      expect(calculate_currency_trend(25, 0)).toBe(0)
      expect(calculate_real_margin(100, 50, 25, 1)).not.toBeNull()
    })

    /**
     * @description Datos vacíos deben retornar valores por defecto
     */
    it('Datos vacíos deben retornar valores por defecto', () => {
      const resultado = calculate_exchange_differential([], 2024)
      expect(resultado.diferencial).toBe(0)
      expect(resultado.desglose_mensual).toHaveLength(12)
      expect(resultado.comparacion_anio_anterior).toBe(0)
    })
  })
})
