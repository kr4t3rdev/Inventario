/**
 * @description Ejemplos de uso de la infraestructura de testing
 * Este archivo demuestra cómo usar los tipos y arbitraries para testing
 */

import { describe, it, expect } from 'vitest'
import {
  fc,
  DEFAULT_PBT_CONFIG,
  monto_arbitrary,
  tasa_cambio_arbitrary,
  producto_con_historial_arbitrary,
  deuda_con_historial_arbitrary,
  tasas_simuladas_arbitrary,
  calculate_percentage_difference,
  calculate_weighted_average,
  is_valid_positive_number,
  assert_all,
  assert_in_range,
  create_mock_cost_impact_data,
  create_mock_kpi_data,
} from '@/lib/testing'

describe('Usage Examples - Property-Based Testing', () => {
  describe('Example 1: Testing Percentage Calculations', () => {
    it('percentage difference should always be finite for positive values', () => {
      fc.assert(
        fc.property(
          monto_arbitrary.filter((m) => m > 0),
          monto_arbitrary.filter((m) => m > 0),
          (value1, value2) => {
            const diff = calculate_percentage_difference(value1, value2)
            return isFinite(diff)
          }
        ),
        DEFAULT_PBT_CONFIG
      )
    })

    it('percentage difference should match manual calculation', () => {
      fc.assert(
        fc.property(
          monto_arbitrary.filter((m) => m > 0),
          monto_arbitrary,
          (base, value) => {
            const result = calculate_percentage_difference(base, value)
            const expected = ((value - base) / base) * 100

            return Math.abs(result - expected) < 0.01
          }
        ),
        DEFAULT_PBT_CONFIG
      )
    })
  })

  describe('Example 2: Testing Cost Impact Calculations', () => {
    it('replacement cost should increase when exchange rate increases', () => {
      fc.assert(
        fc.property(
          producto_con_historial_arbitrary,
          tasa_cambio_arbitrary,
          (producto, nueva_tasa) => {
            // Calcular costo con tasa original
            const costo_original = producto.cantidad_actual * producto.costo_original

            // Calcular costo con nueva tasa
            const factor_ajuste = nueva_tasa / producto.tasa_original
            const costo_nuevo = producto.cantidad_actual * producto.costo_original * factor_ajuste

            // Si la tasa aumenta, el costo debe aumentar
            if (nueva_tasa > producto.tasa_original) {
              return costo_nuevo > costo_original
            }
            // Si la tasa disminuye, el costo debe disminuir
            if (nueva_tasa < producto.tasa_original) {
              return costo_nuevo < costo_original
            }
            // Si la tasa es igual, el costo debe ser igual
            return Math.abs(costo_nuevo - costo_original) < 0.01
          }
        ),
        DEFAULT_PBT_CONFIG
      )
    })
  })

  describe('Example 3: Testing Debt Exposure Calculations', () => {
    it('unrealized loss should be positive when rate increases', () => {
      fc.assert(
        fc.property(
          deuda_con_historial_arbitrary,
          tasa_cambio_arbitrary,
          (deuda, nueva_tasa) => {
            // Calcular deuda en moneda local con tasa original
            const deuda_original = deuda.monto * deuda.tasa_original

            // Calcular deuda en moneda local con nueva tasa
            const deuda_actual = deuda.monto * nueva_tasa

            // Calcular pérdida no realizada
            const perdida = deuda_actual - deuda_original

            // Si la tasa aumenta, debe haber pérdida (positiva)
            if (nueva_tasa > deuda.tasa_original) {
              return perdida > 0
            }
            // Si la tasa disminuye, debe haber ganancia (negativa)
            if (nueva_tasa < deuda.tasa_original) {
              return perdida < 0
            }
            // Si la tasa es igual, no debe haber pérdida
            return Math.abs(perdida) < 0.01
          }
        ),
        DEFAULT_PBT_CONFIG
      )
    })
  })

  describe('Example 4: Testing Weighted Average', () => {
    it('weighted average should be between min and max values', () => {
      fc.assert(
        fc.property(
          fc.array(monto_arbitrary, { minLength: 1, maxLength: 10 }),
          fc.array(monto_arbitrary, { minLength: 1, maxLength: 10 }),
          (values, weights) => {
            // Asegurar que tengan la misma longitud
            const min_length = Math.min(values.length, weights.length)
            const trimmed_values = values.slice(0, min_length)
            const trimmed_weights = weights.slice(0, min_length)

            const avg = calculate_weighted_average(trimmed_values, trimmed_weights)

            const min_value = Math.min(...trimmed_values)
            const max_value = Math.max(...trimmed_values)

            return avg >= min_value && avg <= max_value
          }
        ),
        DEFAULT_PBT_CONFIG
      )
    })
  })

  describe('Example 5: Testing Simulated Rates', () => {
    it('simulated rates should all be positive', () => {
      fc.assert(
        fc.property(tasas_simuladas_arbitrary, (tasas) => {
          return Object.values(tasas).every((tasa) => is_valid_positive_number(tasa) && tasa > 0)
        }),
        DEFAULT_PBT_CONFIG
      )
    })

    it('simulated rates should preserve currency keys', () => {
      fc.assert(
        fc.property(tasas_simuladas_arbitrary, (tasas) => {
          const monedas = Object.keys(tasas)
          const valid_currencies = ['USD', 'EUR', 'MXN', 'COP', 'BRL', 'CLP']

          return monedas.every((moneda) => valid_currencies.includes(moneda))
        }),
        DEFAULT_PBT_CONFIG
      )
    })
  })
})

describe('Usage Examples - Unit Testing with Mock Data', () => {
  describe('Example 6: Testing with Mock Cost Impact Data', () => {
    it('should create valid mock data with defaults', () => {
      const data = create_mock_cost_impact_data()

      expect(data.timeline).toBeDefined()
      expect(data.timeline.length).toBeGreaterThan(0)
      expect(data.resumen).toBeDefined()
      expect(data.resumen.incremento_promedio).toBeGreaterThan(0)
    })

    it('should create valid mock data with overrides', () => {
      const data = create_mock_cost_impact_data({
        resumen: {
          incremento_promedio: 25,
          productos_afectados: 100,
          alerta_ajuste_precios: true,
          costo_historico_total: 1000000,
          costo_reposicion_total: 1250000,
        },
      })

      expect(data.resumen.incremento_promedio).toBe(25)
      expect(data.resumen.productos_afectados).toBe(100)
      expect(data.resumen.alerta_ajuste_precios).toBe(true)
    })
  })

  describe('Example 7: Testing with Mock KPI Data', () => {
    it('should create valid KPI data structure', () => {
      const data = create_mock_kpi_data()

      expect(data.tasa_equilibrio).toBeDefined()
      expect(data.margen_real_vs_nominal).toBeDefined()
      expect(data.diferencial_cambiario_acumulado).toBeDefined()
      expect(data.envejecimiento_deuda).toBeDefined()
    })

    it('should allow customization of specific KPIs', () => {
      const data = create_mock_kpi_data({
        tasa_equilibrio: {
          productos: [],
          productos_criticos: 5,
          productos_advertencia: 10,
          productos_seguros: 85,
          tasa_promedio_equilibrio: 25.5,
        },
      })

      expect(data.tasa_equilibrio.productos_criticos).toBe(5)
      expect(data.tasa_equilibrio.productos_advertencia).toBe(10)
      expect(data.tasa_equilibrio.productos_seguros).toBe(85)
    })
  })
})

describe('Usage Examples - Custom Assertions', () => {
  describe('Example 8: Using assert_all', () => {
    it('should verify all products have positive prices', () => {
      const productos = [
        { id: '1', precio: 100 },
        { id: '2', precio: 200 },
        { id: '3', precio: 300 },
      ]

      expect(() => {
        assert_all(productos, (p) => p.precio > 0, 'All prices must be positive')
      }).not.toThrow()
    })

    it('should throw when assertion fails', () => {
      const productos = [
        { id: '1', precio: 100 },
        { id: '2', precio: -50 },
        { id: '3', precio: 300 },
      ]

      expect(() => {
        assert_all(productos, (p) => p.precio > 0, 'All prices must be positive')
      }).toThrow()
    })
  })

  describe('Example 9: Using assert_in_range', () => {
    it('should verify value is in valid range', () => {
      const percentage = 75

      expect(() => {
        assert_in_range(percentage, 0, 100, 'Percentage must be between 0 and 100')
      }).not.toThrow()
    })

    it('should throw when value is out of range', () => {
      const percentage = 150

      expect(() => {
        assert_in_range(percentage, 0, 100, 'Percentage must be between 0 and 100')
      }).toThrow()
    })
  })
})

describe('Usage Examples - Combining PBT and Unit Tests', () => {
  describe('Example 10: Comprehensive Testing Strategy', () => {
    // Property test para comportamiento general
    it('should handle all valid exchange rates (property test)', () => {
      fc.assert(
        fc.property(
          monto_arbitrary,
          tasa_cambio_arbitrary,
          tasa_cambio_arbitrary,
          (monto, tasa_original, tasa_actual) => {
            const costo_original = monto * tasa_original
            const costo_actual = monto * tasa_actual

            // Ambos costos deben ser positivos
            return is_valid_positive_number(costo_original) && is_valid_positive_number(costo_actual)
          }
        ),
        DEFAULT_PBT_CONFIG
      )
    })

    // Unit tests para casos específicos y edge cases
    it('should handle zero amount (unit test)', () => {
      const monto = 0
      const tasa = 20

      const costo = monto * tasa

      expect(costo).toBe(0)
    })

    it('should handle rate of 1 (unit test)', () => {
      const monto = 100
      const tasa = 1

      const costo = monto * tasa

      expect(costo).toBe(100)
    })

    it('should handle very large rates (unit test)', () => {
      const monto = 100
      const tasa = 1000

      const costo = monto * tasa

      expect(costo).toBe(100000)
    })
  })
})
