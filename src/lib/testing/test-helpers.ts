/**
 * @description Funciones auxiliares para testing del Dashboard de Inteligencia Cambiaria
 */

import type {
  CostImpactData,
  DebtExposureData,
  PaymentEfficiencyData,
  KPIData,
  Alerta,
  TendenciaMoneda,
} from '@/types/exchange-intelligence'

// ============================================================================
// HELPERS PARA VALIDACIÓN DE DATOS
// ============================================================================

/**
 * @description Valida que un número sea positivo y finito
 */
export function is_valid_positive_number(value: number): boolean {
  return typeof value === 'number' && isFinite(value) && value >= 0
}

/**
 * @description Valida que un número sea finito (puede ser negativo)
 */
export function is_valid_number(value: number): boolean {
  return typeof value === 'number' && isFinite(value)
}

/**
 * @description Valida que una fecha esté en formato ISO válido
 */
export function is_valid_iso_date(date: string): boolean {
  const iso_regex = /^\d{4}-\d{2}-\d{2}$/
  if (!iso_regex.test(date)) return false
  
  const parsed = new Date(date)
  return !isNaN(parsed.getTime())
}

/**
 * @description Valida que un rango de fechas sea válido (inicio <= fin)
 */
export function is_valid_date_range(start: string, end: string): boolean {
  if (!is_valid_iso_date(start) || !is_valid_iso_date(end)) return false
  return start <= end
}

/**
 * @description Valida que un porcentaje esté en rango válido (0-100)
 */
export function is_valid_percentage(value: number): boolean {
  return is_valid_number(value) && value >= 0 && value <= 100
}

/**
 * @description Valida que una tasa de cambio sea válida (> 0)
 */
export function is_valid_exchange_rate(rate: number): boolean {
  return is_valid_positive_number(rate) && rate > 0
}

// ============================================================================
// HELPERS PARA CÁLCULOS
// ============================================================================

/**
 * @description Calcula el porcentaje de diferencia entre dos valores
 */
export function calculate_percentage_difference(
  value1: number,
  value2: number
): number {
  if (value1 === 0) return value2 === 0 ? 0 : Infinity
  return ((value2 - value1) / value1) * 100
}

/**
 * @description Calcula el promedio ponderado
 */
export function calculate_weighted_average(
  values: number[],
  weights: number[]
): number {
  if (values.length !== weights.length) {
    throw new Error('Values and weights must have the same length')
  }
  
  const total_weight = weights.reduce((sum, w) => sum + w, 0)
  if (total_weight === 0) return 0
  
  const weighted_sum = values.reduce((sum, v, i) => sum + v * weights[i], 0)
  return weighted_sum / total_weight
}

/**
 * @description Calcula la antigüedad en días entre dos fechas
 */
export function calculate_days_between(
  start_date: string,
  end_date: string
): number {
  const start = new Date(start_date)
  const end = new Date(end_date)
  const diff_ms = end.getTime() - start.getTime()
  return Math.floor(diff_ms / (1000 * 60 * 60 * 24))
}

/**
 * @description Redondea un número a N decimales
 */
export function round_to_decimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

// ============================================================================
// HELPERS PARA GENERACIÓN DE DATOS DE PRUEBA
// ============================================================================

/**
 * @description Genera datos de prueba para CostImpactData
 */
export function create_mock_cost_impact_data(
  overrides?: Partial<CostImpactData>
): CostImpactData {
  return {
    timeline: [
      {
        fecha: '2024-01-01',
        costo_historico: 100000,
        costo_reposicion: 110000,
        diferencia_porcentual: 10,
        productos_afectados: 50,
      },
      {
        fecha: '2024-02-01',
        costo_historico: 100000,
        costo_reposicion: 115000,
        diferencia_porcentual: 15,
        productos_afectados: 55,
      },
    ],
    resumen: {
      incremento_promedio: 12.5,
      productos_afectados: 55,
      alerta_ajuste_precios: true,
      costo_historico_total: 100000,
      costo_reposicion_total: 115000,
    },
    ...overrides,
  }
}

/**
 * @description Genera datos de prueba para DebtExposureData
 */
export function create_mock_debt_exposure_data(
  overrides?: Partial<DebtExposureData>
): DebtExposureData {
  return {
    deuda_original_local: 500000,
    deuda_actual_local: 550000,
    perdida_no_realizada: 50000,
    perdida_porcentual: 10,
    desglose_por_moneda: [
      {
        moneda: 'USD',
        monto_original: 400000,
        monto_actual: 440000,
        diferencia: 40000,
        antiguedad_dias: 180,
        tendencia: 'alcista',
        numero_deudas: 3,
      },
    ],
    ...overrides,
  }
}

/**
 * @description Genera datos de prueba para PaymentEfficiencyData
 */
export function create_mock_payment_efficiency_data(
  overrides?: Partial<PaymentEfficiencyData>
): PaymentEfficiencyData {
  return {
    transacciones: [
      {
        id: '1',
        fecha: '2024-01-15',
        moneda: 'USD',
        monto: 10000,
        tasa_oficial: 20.0,
        tasa_real: 20.5,
        spread_bancario: 2.5,
        superior_promedio: true,
      },
    ],
    metricas: {
      spread_promedio_ponderado: 2.5,
      mejor_tasa: 20.2,
      peor_tasa: 20.8,
      total_transacciones: 10,
      volumen_total: 100000,
      ahorro_potencial: 2500,
    },
    recomendacion_renegociacion: false,
    ...overrides,
  }
}

/**
 * @description Genera datos de prueba para KPIData
 */
export function create_mock_kpi_data(overrides?: Partial<KPIData>): KPIData {
  return {
    tasa_equilibrio: {
      productos: [
        {
          producto_id: '1',
          nombre: 'Producto Test',
          precio_venta: 1000,
          costo_divisa: 40,
          gastos_fijos: 100,
          tasa_equilibrio: 22.5,
          tasa_actual: 20.0,
          proximidad_porcentaje: 88.9,
          estado: 'seguro',
          margen_seguridad: 11.1,
        },
      ],
      productos_criticos: 0,
      productos_advertencia: 0,
      productos_seguros: 1,
      tasa_promedio_equilibrio: 22.5,
    },
    margen_real_vs_nominal: {
      margen_nominal: 500,
      margen_real: 450,
      diferencia_porcentual: -10,
      diferencia_absoluta: -50,
      tendencia_historica: [
        {
          fecha: '2024-01-01',
          margen_nominal: 500,
          margen_real: 480,
          diferencia: -20,
        },
      ],
      alerta_diferencia: false,
    },
    diferencial_cambiario_acumulado: {
      ytd: -25000,
      ytd_porcentaje_ingresos: -2.5,
      desglose_mensual: [
        {
          mes: '2024-01',
          diferencial: -10000,
          ingresos: 100000,
          gastos: 50000,
          porcentaje_ingresos: -10,
        },
      ],
      comparacion_anio_anterior: -15000,
      comparacion_porcentual: -60,
      alerta_cobertura: false,
    },
    envejecimiento_deuda: {
      deudas_priorizadas: [
        {
          deuda_id: '1',
          entidad: 'Proveedor Test',
          moneda: 'USD',
          monto: 10000,
          monto_local: 200000,
          antiguedad_dias: 90,
          tendencia_moneda: 'alcista',
          tendencia_porcentaje: 5,
          prioridad: 0.6,
          impacto_30_dias: 5000,
          impacto_porcentual: 2.5,
        },
      ],
      total_deudas: 1,
      deudas_urgentes: 0,
      impacto_total_30_dias: 5000,
    },
    ...overrides,
  }
}

/**
 * @description Genera una alerta de prueba
 */
export function create_mock_alerta(overrides?: Partial<Alerta>): Alerta {
  return {
    id: '1',
    tipo: 'incremento_costos',
    mensaje: 'El costo de reposición ha aumentado significativamente',
    severidad: 'warning',
    fecha_generacion: '2024-01-15T10:00:00Z',
    valor_actual: 15,
    umbral: 10,
    entidad_afectada: 'Inventario General',
    accion_recomendada: 'Considerar ajuste de precios',
    leida: false,
    ...overrides,
  }
}

// ============================================================================
// HELPERS PARA ASSERTIONS
// ============================================================================

/**
 * @description Verifica que todos los elementos de un array cumplan una condición
 */
export function assert_all<T>(
  array: T[],
  predicate: (item: T) => boolean,
  message?: string
): void {
  const failed = array.filter((item) => !predicate(item))
  if (failed.length > 0) {
    throw new Error(
      message || `${failed.length} items failed the predicate. First failure: ${JSON.stringify(failed[0])}`
    )
  }
}

/**
 * @description Verifica que un valor esté dentro de un rango
 */
export function assert_in_range(
  value: number,
  min: number,
  max: number,
  message?: string
): void {
  if (value < min || value > max) {
    throw new Error(
      message || `Value ${value} is not in range [${min}, ${max}]`
    )
  }
}

/**
 * @description Verifica que dos números sean aproximadamente iguales
 */
export function assert_approximately_equal(
  actual: number,
  expected: number,
  tolerance: number = 0.01,
  message?: string
): void {
  const diff = Math.abs(actual - expected)
  if (diff > tolerance) {
    throw new Error(
      message || `Expected ${actual} to be approximately ${expected} (tolerance: ${tolerance}), but difference was ${diff}`
    )
  }
}

/**
 * @description Verifica que un array esté ordenado
 */
export function assert_sorted<T>(
  array: T[],
  compareFn: (a: T, b: T) => number,
  message?: string
): void {
  for (let i = 1; i < array.length; i++) {
    if (compareFn(array[i - 1], array[i]) > 0) {
      throw new Error(
        message || `Array is not sorted at index ${i}. Previous: ${JSON.stringify(array[i - 1])}, Current: ${JSON.stringify(array[i])}`
      )
    }
  }
}

// ============================================================================
// HELPERS PARA CLASIFICACIÓN
// ============================================================================

/**
 * @description Clasifica la tendencia de una moneda basada en cambio porcentual
 */
export function classify_currency_trend(
  percentage_change: number
): TendenciaMoneda {
  if (percentage_change > 2) return 'alcista'
  if (percentage_change < -2) return 'bajista'
  return 'estable'
}

/**
 * @description Clasifica el estado de un producto según proximidad a equilibrio
 */
export function classify_product_status(
  proximity_percentage: number
): 'seguro' | 'advertencia' | 'critico' {
  if (proximity_percentage >= 100) return 'critico'
  if (proximity_percentage >= 90) return 'advertencia'
  return 'seguro'
}

// ============================================================================
// HELPERS PARA COMPARACIÓN DE OBJETOS
// ============================================================================

/**
 * @description Compara dos objetos ignorando propiedades específicas
 */
export function deep_equal_except<T extends Record<string, unknown>>(
  obj1: T,
  obj2: T,
  ignore_keys: string[]
): boolean {
  const filtered1 = Object.fromEntries(
    Object.entries(obj1).filter(([key]) => !ignore_keys.includes(key))
  )
  const filtered2 = Object.fromEntries(
    Object.entries(obj2).filter(([key]) => !ignore_keys.includes(key))
  )
  
  return JSON.stringify(filtered1) === JSON.stringify(filtered2)
}

/**
 * @description Extrae valores numéricos de un objeto para comparación
 */
export function extract_numeric_values(obj: unknown): number[] {
  const values: number[] = []
  
  function extract(value: unknown): void {
    if (typeof value === 'number' && isFinite(value)) {
      values.push(value)
    } else if (Array.isArray(value)) {
      value.forEach(extract)
    } else if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach(extract)
    }
  }
  
  extract(obj)
  return values
}

// ============================================================================
// HELPERS PARA DEBUGGING
// ============================================================================

/**
 * @description Formatea un objeto para logging legible
 */
export function format_for_logging(obj: unknown, indent: number = 2): string {
  return JSON.stringify(obj, null, indent)
}

/**
 * @description Crea un resumen de un array para debugging
 */
export function summarize_array<T>(
  array: T[],
  max_items: number = 3
): string {
  if (array.length <= max_items) {
    return JSON.stringify(array)
  }
  
  const sample = array.slice(0, max_items)
  return `[${sample.map((item) => JSON.stringify(item)).join(', ')}, ... (${array.length - max_items} more)]`
}
