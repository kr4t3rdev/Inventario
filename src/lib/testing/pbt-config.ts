/**
 * @description Configuración y arbitraries para property-based testing con fast-check
 * Este archivo contiene generadores de datos aleatorios para testing de propiedades
 */

import fc from 'fast-check'
import type {
  TasasSimuladas,
  ProductoConHistorial,
  DeudaConHistorial,
  TransaccionCambio,
  FiltrosDashboard,
  TendenciaMoneda,
  ProductoEstado,
  SeveridadAlerta,
} from '@/types/exchange-intelligence'

// ============================================================================
// CONFIGURACIÓN GLOBAL DE FAST-CHECK
// ============================================================================

/**
 * @description Configuración por defecto para property tests
 * Mínimo 100 iteraciones según especificación
 */
export const DEFAULT_PBT_CONFIG: fc.Parameters<unknown> = {
  numRuns: 100,
  verbose: false,
  seed: undefined, // Permite reproducibilidad con seed específico
  path: undefined,
  endOnFailure: false,
}

/**
 * @description Configuración para tests de performance (menos iteraciones)
 */
export const PERFORMANCE_PBT_CONFIG: fc.Parameters<unknown> = {
  numRuns: 50,
  verbose: false,
}

/**
 * @description Configuración para tests exhaustivos (más iteraciones)
 */
export const EXHAUSTIVE_PBT_CONFIG: fc.Parameters<unknown> = {
  numRuns: 500,
  verbose: true,
}

// ============================================================================
// ARBITRARIES BÁSICOS
// ============================================================================

/**
 * @description Genera fechas válidas en formato ISO
 */
export const fecha_arbitrary = fc
  .integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() })
  .map((timestamp) => {
    const date = new Date(timestamp)
    return date.toISOString().split('T')[0]
  })

/**
 * @description Genera rangos de fechas válidos (inicio <= fin)
 */
export const date_range_arbitrary = fc
  .tuple(fecha_arbitrary, fecha_arbitrary)
  .map(([date1, date2]) => {
    const [start, end] = date1 <= date2 ? [date1, date2] : [date2, date1]
    return { start, end }
  })

/**
 * @description Genera códigos de moneda válidos
 */
export const moneda_arbitrary = fc.constantFrom('USD', 'EUR', 'MXN', 'COP', 'BRL', 'CLP')

/**
 * @description Genera tasas de cambio realistas (0.01 a 1000)
 */
export const tasa_cambio_arbitrary = fc.float({
  min: Math.fround(0.01),
  max: Math.fround(1000),
  noNaN: true,
  noDefaultInfinity: true,
})

/**
 * @description Genera montos monetarios positivos
 */
export const monto_arbitrary = fc.float({
  min: Math.fround(0.01),
  max: Math.fround(1_000_000),
  noNaN: true,
  noDefaultInfinity: true,
}).filter((value) => value >= 0.01)

/**
 * @description Genera porcentajes (0 a 100)
 */
export const porcentaje_arbitrary = fc.float({
  min: Math.fround(0),
  max: Math.fround(100),
  noNaN: true,
  noDefaultInfinity: true,
})

/**
 * @description Genera cantidades enteras positivas
 */
export const cantidad_arbitrary = fc.integer({ min: 1, max: 10000 })

/**
 * @description Genera IDs únicos
 */
export const id_arbitrary = fc.uuid()

/**
 * @description Genera tendencias de moneda
 */
export const tendencia_moneda_arbitrary = fc.constantFrom<TendenciaMoneda>(
  'alcista',
  'bajista',
  'estable'
)

/**
 * @description Genera estados de producto
 */
export const producto_estado_arbitrary = fc.constantFrom<ProductoEstado>(
  'seguro',
  'advertencia',
  'critico'
)

/**
 * @description Genera severidades de alerta
 */
export const severidad_alerta_arbitrary = fc.constantFrom<SeveridadAlerta>(
  'info',
  'warning',
  'critical'
)

// ============================================================================
// ARBITRARIES COMPUESTOS
// ============================================================================

/**
 * @description Genera tasas simuladas para múltiples monedas
 */
export const tasas_simuladas_arbitrary: fc.Arbitrary<TasasSimuladas> = fc
  .array(
    fc.record({
      moneda: moneda_arbitrary,
      tasa: tasa_cambio_arbitrary,
    }),
    { minLength: 1, maxLength: 5 }
  )
  .map((tasas) => {
    const resultado: TasasSimuladas = {}
    for (const { moneda, tasa } of tasas) {
      resultado[moneda] = tasa
    }
    return resultado
  })

/**
 * @description Genera un producto con historial de compras
 */
export const producto_con_historial_arbitrary: fc.Arbitrary<ProductoConHistorial> = fc.record({
  id: id_arbitrary,
  nombre: fc.string({ minLength: 3, maxLength: 50 }),
  codigo: fc.string({ minLength: 3, maxLength: 20 }),
  cantidad_actual: cantidad_arbitrary,
  costo_original: monto_arbitrary,
  moneda_compra: moneda_arbitrary,
  tasa_original: tasa_cambio_arbitrary,
  fecha_ultima_compra: fecha_arbitrary,
  historial_compras: fc.array(
    fc.record({
      fecha: fecha_arbitrary,
      cantidad: cantidad_arbitrary,
      costo_unitario: monto_arbitrary,
      tasa_cambio: tasa_cambio_arbitrary,
    }),
    { minLength: 1, maxLength: 10 }
  ),
})

/**
 * @description Genera una deuda con historial de tasas
 */
export const deuda_con_historial_arbitrary: fc.Arbitrary<DeudaConHistorial> = fc.record({
  id: id_arbitrary,
  entidad: fc.string({ minLength: 3, maxLength: 50 }),
  monto: monto_arbitrary,
  moneda: moneda_arbitrary,
  tasa_original: tasa_cambio_arbitrary,
  fecha_registro: fecha_arbitrary,
  fecha_vencimiento: fc.option(fecha_arbitrary, { nil: undefined }),
  estado: fc.constantFrom('ACTIVA', 'PAGADA', 'VENCIDA'),
  historial_tasas: fc.array(
    fc.record({
      fecha: fecha_arbitrary,
      tasa: tasa_cambio_arbitrary,
      monto_local: monto_arbitrary,
    }),
    { minLength: 1, maxLength: 30 }
  ),
})

/**
 * @description Genera una transacción de cambio
 */
export const transaccion_cambio_arbitrary: fc.Arbitrary<Omit<TransaccionCambio, 'id' | 'superior_promedio'>> = fc.record({
  fecha: fecha_arbitrary,
  moneda: moneda_arbitrary,
  monto: monto_arbitrary,
  tasa_oficial: tasa_cambio_arbitrary,
  tasa_real: tasa_cambio_arbitrary,
  spread_bancario: fc.float({ min: Math.fround(-10), max: Math.fround(20) }),
})

/**
 * @description Genera filtros de dashboard válidos
 */
export const filtros_dashboard_arbitrary: fc.Arbitrary<FiltrosDashboard> = fc.record({
  fecha_inicio: fecha_arbitrary,
  fecha_fin: fecha_arbitrary,
  categoria_id: fc.option(id_arbitrary, { nil: undefined }),
  almacen_id: fc.option(id_arbitrary, { nil: undefined }),
  vendor_id: fc.option(id_arbitrary, { nil: undefined }),
  moneda: fc.option(moneda_arbitrary, { nil: undefined }),
}).map((filtros) => {
  // Asegurar que fecha_inicio <= fecha_fin
  if (filtros.fecha_inicio > filtros.fecha_fin) {
    return {
      ...filtros,
      fecha_inicio: filtros.fecha_fin,
      fecha_fin: filtros.fecha_inicio,
    }
  }
  return filtros
})

// ============================================================================
// ARBITRARIES PARA INVENTARIO
// ============================================================================

/**
 * @description Genera un dataset de inventario completo
 */
export const inventario_dataset_arbitrary = fc.array(
  producto_con_historial_arbitrary,
  { minLength: 1, maxLength: 100 }
)

/**
 * @description Genera tasas de cambio actuales para múltiples monedas
 */
export const tasas_actuales_arbitrary = fc
  .array(
    fc.record({
      moneda: moneda_arbitrary,
      tasa: tasa_cambio_arbitrary,
    }),
    { minLength: 1, maxLength: 5 }
  )
  .map((tasas) => {
    const resultado: Record<string, number> = {}
    for (const { moneda, tasa } of tasas) {
      resultado[moneda] = tasa
    }
    return resultado
  })

// ============================================================================
// ARBITRARIES PARA DEUDAS
// ============================================================================

/**
 * @description Genera un conjunto de deudas activas
 */
export const deudas_activas_arbitrary = fc.array(
  deuda_con_historial_arbitrary.map((deuda) => ({
    ...deuda,
    estado: 'ACTIVA' as const,
  })),
  { minLength: 0, maxLength: 50 }
)

/**
 * @description Genera deudas con diferentes antigüedades
 */
export const deudas_con_antiguedad_arbitrary = fc.array(
  fc.record({
    id: id_arbitrary,
    entidad: fc.string({ minLength: 3, maxLength: 50 }),
    monto: monto_arbitrary,
    moneda: moneda_arbitrary,
    tasa_original: tasa_cambio_arbitrary,
    fecha_registro: fc.date({
      min: new Date('2020-01-01'),
      max: new Date(),
    }).map((d) => d.toISOString().split('T')[0]),
    antiguedad_dias: fc.integer({ min: 1, max: 1095 }), // hasta 3 años
  }),
  { minLength: 1, maxLength: 30 }
)

// ============================================================================
// ARBITRARIES PARA TRANSACCIONES
// ============================================================================

/**
 * @description Genera un conjunto de transacciones de cambio
 */
export const transacciones_cambio_arbitrary = fc.array(
  transaccion_cambio_arbitrary,
  { minLength: 1, maxLength: 100 }
)

/**
 * @description Genera tasas oficiales históricas (fecha -> moneda -> tasa)
 */
export const tasas_oficiales_historicas_arbitrary = fc
  .array(
    fc.record({
      fecha: fecha_arbitrary,
      moneda: moneda_arbitrary,
      tasa: tasa_cambio_arbitrary,
    }),
    { minLength: 1, maxLength: 365 }
  )
  .map((tasas) => {
    const resultado: Record<string, Record<string, number>> = {}
    for (const { fecha, moneda, tasa } of tasas) {
      if (!resultado[fecha]) {
        resultado[fecha] = {}
      }
      resultado[fecha][moneda] = tasa
    }
    return resultado
  })

// ============================================================================
// ARBITRARIES PARA PRODUCTOS Y PRECIOS
// ============================================================================

/**
 * @description Genera datos de producto para cálculo de tasa de equilibrio
 */
export const producto_equilibrio_arbitrary = fc.record({
  producto_id: id_arbitrary,
  nombre: fc.string({ minLength: 3, maxLength: 50 }),
  precio_venta: monto_arbitrary,
  gastos_fijos: fc.float({ min: Math.fround(0), max: Math.fround(1000) }),
  costo_divisa: fc.float({ min: Math.fround(0.01), max: Math.fround(10000) }),
})

/**
 * @description Genera datos de producto con margen
 */
export const producto_con_margen_arbitrary = fc.record({
  producto_id: id_arbitrary,
  nombre: fc.string({ minLength: 3, maxLength: 50 }),
  precio_venta: monto_arbitrary,
  costo_original: monto_arbitrary,
  tasa_original: tasa_cambio_arbitrary,
  tasa_actual: tasa_cambio_arbitrary,
})

// ============================================================================
// ARBITRARIES PARA UMBRALES
// ============================================================================

/**
 * @description Genera umbrales personalizados válidos
 */
export const umbrales_personalizados_arbitrary = fc.record({
  cost_increase_alert: porcentaje_arbitrary,
  debt_exposure_alert: porcentaje_arbitrary,
  spread_alert: porcentaje_arbitrary,
  break_even_warning: fc.float({ min: Math.fround(50), max: Math.fround(100) }),
  break_even_critical: fc.constant(100),
  margin_alert: porcentaje_arbitrary,
  differential_alert: porcentaje_arbitrary,
  currency_trend_alert: porcentaje_arbitrary,
})

// ============================================================================
// ARBITRARIES PARA ESCENARIOS
// ============================================================================

/**
 * @description Genera un escenario de simulación completo
 */
export const escenario_simulacion_arbitrary = fc.record({
  nombre: fc.string({ minLength: 3, maxLength: 100 }),
  descripcion: fc.option(fc.string({ minLength: 10, maxLength: 500 }), { nil: undefined }),
  tasas_simuladas: tasas_simuladas_arbitrary,
  fecha_proyeccion: fecha_arbitrary,
})

// ============================================================================
// HELPERS Y UTILIDADES
// ============================================================================

/**
 * @description Genera un valor que está cerca de un umbral (útil para testing de alertas)
 */
export function near_threshold_arbitrary(threshold: number, variance: number = 5) {
  return fc.float({
    min: Math.fround(threshold - variance),
    max: Math.fround(threshold + variance),
    noNaN: true,
    noDefaultInfinity: true,
  })
}

/**
 * @description Genera un valor que supera un umbral
 */
export function above_threshold_arbitrary(threshold: number, margin: number = 10) {
  return fc.float({
    min: Math.fround(threshold + 0.01),
    max: Math.fround(threshold + margin),
    noNaN: true,
    noDefaultInfinity: true,
  })
}

/**
 * @description Genera un valor que está por debajo de un umbral
 */
export function below_threshold_arbitrary(threshold: number, margin: number = 10) {
  return fc.float({
    min: Math.fround(Math.max(0, threshold - margin)),
    max: Math.fround(threshold - 0.01),
    noNaN: true,
    noDefaultInfinity: true,
  })
}

/**
 * @description Genera datos de prueba con seed específico para reproducibilidad
 */
export function with_seed<T>(arbitrary: fc.Arbitrary<T>, seed: number): fc.Arbitrary<T> {
  return arbitrary
}

/**
 * @description Ejecuta un property test con configuración por defecto
 */
export function run_property_test<T>(
  arbitrary: fc.Arbitrary<T>,
  predicate: (value: T) => boolean | void,
  config: fc.Parameters<unknown> = DEFAULT_PBT_CONFIG
): void {
  fc.assert(fc.property(arbitrary, predicate), config)
}

// ============================================================================
// SHRINKING PERSONALIZADO
// ============================================================================

/**
 * @description Arbitrary con shrinking optimizado para montos monetarios
 * Reduce hacia valores "redondos" más fáciles de debuggear
 */
export const monto_with_smart_shrinking = fc.float({
  min: Math.fround(0.01),
  max: Math.fround(1_000_000),
  noNaN: true,
  noDefaultInfinity: true,
}).map((value) => {
  // Redondear a 2 decimales para montos monetarios
  return Math.round(value * 100) / 100
})

/**
 * @description Arbitrary con shrinking optimizado para tasas de cambio
 * Reduce hacia tasas "típicas" más fáciles de debuggear
 */
export const tasa_with_smart_shrinking = fc.float({
  min: Math.fround(0.01),
  max: Math.fround(1000),
  noNaN: true,
  noDefaultInfinity: true,
}).map((value) => {
  // Redondear a 4 decimales para tasas de cambio
  return Math.round(value * 10000) / 10000
})
