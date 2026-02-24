/**
 * @description Tests de verificación para la configuración de property-based testing
 * Estos tests aseguran que los arbitraries funcionan correctamente
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  DEFAULT_PBT_CONFIG,
  fecha_arbitrary,
  date_range_arbitrary,
  moneda_arbitrary,
  tasa_cambio_arbitrary,
  monto_arbitrary,
  porcentaje_arbitrary,
  tasas_simuladas_arbitrary,
  producto_con_historial_arbitrary,
  deuda_con_historial_arbitrary,
  filtros_dashboard_arbitrary,
  is_valid_iso_date,
  is_valid_positive_number,
  is_valid_percentage,
} from '@/lib/testing'

describe('PBT Configuration - Arbitraries Verification', () => {
  describe('Basic Arbitraries', () => {
    it('fecha_arbitrary should generate valid ISO dates', () => {
      fc.assert(
        fc.property(fecha_arbitrary, (fecha) => {
          return is_valid_iso_date(fecha)
        }),
        { numRuns: 50 }
      )
    })

    it('date_range_arbitrary should generate valid date ranges', () => {
      fc.assert(
        fc.property(date_range_arbitrary, ({ start, end }) => {
          return is_valid_iso_date(start) && is_valid_iso_date(end) && start <= end
        }),
        { numRuns: 50 }
      )
    })

    it('moneda_arbitrary should generate valid currency codes', () => {
      fc.assert(
        fc.property(moneda_arbitrary, (moneda) => {
          const valid_currencies = ['USD', 'EUR', 'MXN', 'COP', 'BRL', 'CLP']
          return valid_currencies.includes(moneda)
        }),
        { numRuns: 50 }
      )
    })

    it('tasa_cambio_arbitrary should generate valid exchange rates', () => {
      fc.assert(
        fc.property(tasa_cambio_arbitrary, (tasa) => {
          return is_valid_positive_number(tasa) && tasa >= 0.01 && tasa <= 1000
        }),
        { numRuns: 50 }
      )
    })

    it('monto_arbitrary should generate valid monetary amounts', () => {
      fc.assert(
        fc.property(monto_arbitrary, (monto) => {
          return is_valid_positive_number(monto) && monto >= 0.01
        }),
        { numRuns: 50 }
      )
    })

    it('porcentaje_arbitrary should generate valid percentages', () => {
      fc.assert(
        fc.property(porcentaje_arbitrary, (porcentaje) => {
          return is_valid_percentage(porcentaje)
        }),
        { numRuns: 50 }
      )
    })
  })

  describe('Compound Arbitraries', () => {
    it('tasas_simuladas_arbitrary should generate valid simulated rates', () => {
      fc.assert(
        fc.property(tasas_simuladas_arbitrary, (tasas) => {
          // Debe tener al menos una moneda
          const monedas = Object.keys(tasas)
          if (monedas.length === 0) return false

          // Todas las tasas deben ser válidas
          return Object.values(tasas).every((tasa) => is_valid_positive_number(tasa))
        }),
        { numRuns: 50 }
      )
    })

    it('producto_con_historial_arbitrary should generate valid products', () => {
      fc.assert(
        fc.property(producto_con_historial_arbitrary, (producto) => {
          // Verificar campos requeridos
          const has_required_fields =
            typeof producto.id === 'string' &&
            typeof producto.nombre === 'string' &&
            typeof producto.codigo === 'string' &&
            is_valid_positive_number(producto.cantidad_actual) &&
            is_valid_positive_number(producto.costo_original) &&
            is_valid_positive_number(producto.tasa_original)

          // Verificar historial
          const has_valid_history =
            Array.isArray(producto.historial_compras) &&
            producto.historial_compras.length > 0 &&
            producto.historial_compras.every(
              (compra) =>
                is_valid_iso_date(compra.fecha) &&
                is_valid_positive_number(compra.cantidad) &&
                is_valid_positive_number(compra.costo_unitario) &&
                is_valid_positive_number(compra.tasa_cambio)
            )

          return has_required_fields && has_valid_history
        }),
        { numRuns: 50 }
      )
    })

    it('deuda_con_historial_arbitrary should generate valid debts', () => {
      fc.assert(
        fc.property(deuda_con_historial_arbitrary, (deuda) => {
          // Verificar campos requeridos
          const has_required_fields =
            typeof deuda.id === 'string' &&
            typeof deuda.entidad === 'string' &&
            is_valid_positive_number(deuda.monto) &&
            typeof deuda.moneda === 'string' &&
            is_valid_positive_number(deuda.tasa_original) &&
            is_valid_iso_date(deuda.fecha_registro)

          // Verificar historial
          const has_valid_history =
            Array.isArray(deuda.historial_tasas) &&
            deuda.historial_tasas.length > 0 &&
            deuda.historial_tasas.every(
              (tasa) =>
                is_valid_iso_date(tasa.fecha) &&
                is_valid_positive_number(tasa.tasa) &&
                is_valid_positive_number(tasa.monto_local)
            )

          return has_required_fields && has_valid_history
        }),
        { numRuns: 50 }
      )
    })

    it('filtros_dashboard_arbitrary should generate valid filters', () => {
      fc.assert(
        fc.property(filtros_dashboard_arbitrary, (filtros) => {
          // Verificar fechas válidas
          const has_valid_dates =
            is_valid_iso_date(filtros.fecha_inicio) &&
            is_valid_iso_date(filtros.fecha_fin) &&
            filtros.fecha_inicio <= filtros.fecha_fin

          return has_valid_dates
        }),
        { numRuns: 50 }
      )
    })
  })

  describe('Configuration Objects', () => {
    it('DEFAULT_PBT_CONFIG should have correct settings', () => {
      expect(DEFAULT_PBT_CONFIG.numRuns).toBe(100)
      expect(DEFAULT_PBT_CONFIG.verbose).toBe(false)
    })

    it('should be able to run property tests with default config', () => {
      // Este test verifica que la configuración funciona correctamente
      fc.assert(
        fc.property(fc.integer(), (n) => {
          return typeof n === 'number'
        }),
        DEFAULT_PBT_CONFIG
      )
    })
  })

  describe('Arbitrary Composition', () => {
    it('should be able to combine multiple arbitraries', () => {
      fc.assert(
        fc.property(
          monto_arbitrary,
          tasa_cambio_arbitrary,
          (monto, tasa) => {
            const resultado = monto * tasa
            return is_valid_positive_number(resultado)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should be able to filter arbitraries', () => {
      const large_amounts = monto_arbitrary.filter((m) => m > 1000)

      fc.assert(
        fc.property(large_amounts, (monto) => {
          return monto > 1000
        }),
        { numRuns: 50 }
      )
    })

    it('should be able to map arbitraries', () => {
      const rounded_amounts = monto_arbitrary.map((m) => Math.round(m * 100) / 100)

      fc.assert(
        fc.property(rounded_amounts, (monto) => {
          // Verificar que tiene máximo 2 decimales
          const decimals = (monto.toString().split('.')[1] || '').length
          return decimals <= 2
        }),
        { numRuns: 50 }
      )
    })
  })
})
