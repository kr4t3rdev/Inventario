/**
 * @fileoverview Tipos TypeScript para el Dashboard de Inteligencia Cambiaria
 * Define todas las interfaces y tipos utilizados en el sistema de análisis cambiario
 */

// ========== TIPOS BASE ==========

/**
 * @typedef {Object} CurrencyCode
 * @description Códigos de moneda estándar (ISO 4217)
 */
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'MXN' | string;

/**
 * @typedef {Object} ExchangeRate
 * @description Estructura para tasas de cambio
 */
export interface ExchangeRate {
  /** Código de la moneda base */
  from_currency: CurrencyCode;
  /** Código de la moneda destino */
  to_currency: CurrencyCode;
  /** Tasa de cambio (cuántas unidades de to_currency por 1 from_currency) */
  rate: number;
  /** Fecha de la tasa */
  date: string;
  /** Fuente de la tasa (BANXICO, ECB, etc.) */
  source?: string;
}

// ========== SECCIÓN A: IMPACTO EN COSTOS ==========

/**
 * @typedef {Object} CostImpactData
 * @description Datos para visualización del impacto en costos
 */
export interface CostImpactData {
  /** Fecha del punto de datos */
  fecha: string;
  /** Costo histórico del inventario */
  costo_historico: number;
  /** Costo de reposición con tasas actuales */
  costo_reposicion: number;
  /** Diferencia porcentual */
  diferencia_porcentual: number;
  /** Número de productos afectados */
  productos_afectados: number;
}

/**
 * @typedef {Object} CostImpactSectionProps
 * @description Props para el componente CostImpactSection
 */
export interface CostImpactSectionProps {
  /** Fecha de inicio del análisis */
  fecha_inicio: string;
  /** Fecha de fin del análisis */
  fecha_fin: string;
  /** Filtro opcional por categoría */
  categoria_id?: string;
  /** Filtro opcional por almacén */
  almacen_id?: string;
  /** Filtro opcional por proveedor */
  vendor_id?: string;
}

// ========== SECCIÓN B: EXPOSICIÓN DE DEUDA ==========

/**
 * @typedef {Object} DebtExposureData
 * @description Datos para visualización de exposición de deuda
 */
export interface DebtExposureData {
  /** Deuda total original en moneda local */
  deuda_original_local: number;
  /** Deuda total actual en moneda local */
  deuda_actual_local: number;
  /** Pérdida no realizada */
  perdida_no_realizada: number;
  /** Desglose por moneda */
  desglose_por_moneda: Array<{
    /** Código de moneda */
    moneda: string;
    /** Monto original */
    monto_original: number;
    /** Monto actual */
    monto_actual: number;
    /** Diferencia */
    diferencia: number;
    /** Antigüedad en días */
    antiguedad_dias: number;
    /** Tendencia de la moneda */
    tendencia: 'alcista' | 'bajista' | 'estable';
  }>;
}

/**
 * @typedef {Object} DebtExposureSectionProps
 * @description Props para el componente DebtExposureSection
 */
export interface DebtExposureSectionProps {
  /** Fecha de corte para el análisis */
  fecha_corte?: string;
}

// ========== SECCIÓN C: EFICIENCIA DE PAGOS ==========

/**
 * @typedef {Object} PaymentEfficiencyData
 * @description Datos para visualización de eficiencia de pagos
 */
export interface PaymentEfficiencyData {
  /** Lista de transacciones con spreads */
  transacciones: Array<{
    /** Fecha de la transacción */
    fecha: string;
    /** Moneda de la transacción */
    moneda: string;
    /** Monto de la transacción */
    monto: number;
    /** Tasa oficial del mercado */
    tasa_oficial: number;
    /** Tasa real obtenida */
    tasa_real: number;
    /** Spread bancario porcentual */
    spread_bancario: number;
  }>;
  /** Spread promedio ponderado */
  spread_promedio_ponderado: number;
  /** Mejor tasa obtenida */
  mejor_tasa: number;
  /** Peor tasa obtenida */
  peor_tasa: number;
}

/**
 * @typedef {Object} PaymentEfficiencySectionProps
 * @description Props para el componente PaymentEfficiencySection
 */
export interface PaymentEfficiencySectionProps {
  /** Fecha de inicio del período */
  fecha_inicio: string;
  /** Fecha de fin del período */
  fecha_fin: string;
  /** Filtro opcional por moneda */
  moneda?: string;
}

// ========== PANEL DE KPIs ==========

/**
 * @typedef {Object} KPIData
 * @description Datos unificados para todos los KPIs
 */
export interface KPIData {
  /** KPI de Tasa de Equilibrio */
  tasa_equilibrio: {
    /** Lista de productos con sus tasas de equilibrio */
    productos: Array<{
      /** ID del producto */
      producto_id: string;
      /** Nombre del producto */
      nombre: string;
      /** Tasa de equilibrio calculada */
      tasa_equilibrio: number;
      /** Tasa actual del mercado */
      tasa_actual: number;
      /** Proximidad porcentual a la tasa de equilibrio */
      proximidad_porcentaje: number;
      /** Estado de clasificación */
      estado: 'seguro' | 'advertencia' | 'critico';
    }>;
  };
  /** KPI de Margen Real vs Nominal */
  margen_real_vs_nominal: {
    /** Margen nominal */
    margen_nominal: number;
    /** Margen real ajustado por tipo de cambio */
    margen_real: number;
    /** Diferencia porcentual */
    diferencia_porcentual: number;
    /** Tendencia histórica */
    tendencia_historica: Array<{
      /** Fecha del punto */
      fecha: string;
      /** Margen nominal en esa fecha */
      margen_nominal: number;
      /** Margen real en esa fecha */
      margen_real: number;
    }>;
  };
  /** KPI de Diferencial Cambiario Acumulado */
  diferencial_cambiario_acumulado: {
    /** Diferencial YTD */
    ytd: number;
    /** Desglose mensual */
    desglose_mensual: Array<{
      /** Mes */
      mes: string;
      /** Diferencial del mes */
      diferencial: number;
    }>;
    /** Comparación con año anterior */
    comparacion_anio_anterior: number;
  };
  /** KPI de Envejecimiento de Deuda */
  envejecimiento_deuda: Array<{
    /** ID de la deuda */
    deuda_id: string;
    /** Entidad deudora */
    entidad: string;
    /** Moneda de la deuda */
    moneda: string;
    /** Monto de la deuda */
    monto: number;
    /** Antigüedad en días */
    antiguedad_dias: number;
    /** Tendencia de la moneda */
    tendencia_moneda: 'alcista' | 'bajista' | 'estable';
    /** Score de prioridad */
    prioridad: number;
    /** Impacto potencial de pagar hoy vs 30 días */
    impacto_30_dias: number;
  }>;
}

/**
 * @typedef {Object} KPIDashboardProps
 * @description Props para el componente KPIDashboard
 */
export interface KPIDashboardProps {
  /** Fecha de inicio del período */
  fecha_inicio: string;
  /** Fecha de fin del período */
  fecha_fin: string;
}

// ========== SIMULADOR DE ESCENARIOS ==========

/**
 * @typedef {Object} ScenarioSimulatorProps
 * @description Props para el componente ScenarioSimulator
 */
export interface ScenarioSimulatorProps {
  /** Datos actuales del sistema para baseline */
  datos_actuales?: KPIData;
}

/**
 * @typedef {Object} SimulationResult
 * @description Resultado de una simulación de escenario
 */
export interface SimulationResult {
  /** Costo de reposición proyectado */
  costo_reposicion_proyectado: number;
  /** Pérdida no realizada proyectada */
  perdida_no_realizada_proyectada: number;
  /** Margen real proyectado */
  margen_real_proyectado: number;
  /** Utilidad neta proyectada */
  utilidad_neta_proyectada: number;
  /** Alertas generadas por el escenario */
  alertas_generadas: Array<{
    /** Tipo de alerta */
    tipo: string;
    /** Mensaje descriptivo */
    mensaje: string;
    /** Severidad de la alerta */
    severidad: 'info' | 'warning' | 'critical';
  }>;
}

// ========== DASHBOARD PRINCIPAL ==========

/**
 * @typedef {Object} ExchangeIntelligenceDashboardProps
 * @description Props para el componente principal del dashboard
 */
export interface ExchangeIntelligenceDashboardProps {
  /** Fecha de inicio del período de análisis */
  fecha_inicio?: string;
  /** Fecha de fin del período de análisis */
  fecha_fin?: string;
}

// ========== APIs REQUEST/RESPONSE ==========

/**
 * @typedef {Object} CostImpactRequest
 * @description Request para el endpoint de impacto en costos
 */
export interface CostImpactRequest {
  /** Fecha de inicio */
  fecha_inicio: string;
  /** Fecha de fin */
  fecha_fin: string;
  /** Filtro por categoría */
  categoria_id?: string;
  /** Filtro por almacén */
  almacen_id?: string;
  /** Filtro por proveedor */
  vendor_id?: string;
}

/**
 * @typedef {Object} CostImpactResponse
 * @description Response del endpoint de impacto en costos
 */
export interface CostImpactResponse {
  /** Timeline de datos */
  timeline: Array<{
    /** Fecha */
    fecha: string;
    /** Costo histórico */
    costo_historico: number;
    /** Costo de reposición */
    costo_reposicion: number;
    /** Diferencia porcentual */
    diferencia_porcentual: number;
  }>;
  por_producto?: Array<{
    producto_id: string;
    nombre: string;
    gasto_historico: number;
    gasto_reposicion: number;
    diferencia_porcentual: number;
    reposiciones: number;
    impacto_fx_total: number;
  }>;
  detalle_reposiciones?: Array<{
    producto_id: string;
    producto_nombre: string;
    fecha: string;
    moneda: string;
    monto_moneda: number;
    tasa_original: number;
    tasa_actual: number;
    gasto_historico_local: number;
    gasto_reposicion_local: number;
    impacto_fx: number;
    variacion_porcentual_fx: number;
  }>;
  moneda_principal?: string;
  /** Resumen del período */
  resumen: {
    /** Incremento promedio */
    incremento_promedio: number;
    /** Productos afectados */
    productos_afectados: number;
    /** Flag de alerta de ajuste de precios */
    alerta_ajuste_precios: boolean;
  };
}

/**
 * @typedef {Object} DebtExposureRequest
 * @description Request para el endpoint de exposición de deuda
 */
export interface DebtExposureRequest {
  /** Fecha de corte */
  fecha_corte?: string;
}

/**
 * @typedef {Object} DebtExposureResponse
 * @description Response del endpoint de exposición de deuda
 */
export interface DebtExposureResponse {
  /** Deuda original en local */
  deuda_original_local: number;
  /** Deuda actual en local */
  deuda_actual_local: number;
  /** Pérdida no realizada */
  perdida_no_realizada: number;
  /** Desglose por moneda */
  desglose_por_moneda: Array<{
    /** Moneda */
    moneda: string;
    /** Monto original */
    monto_original: number;
    /** Monto actual */
    monto_actual: number;
    /** Diferencia */
    diferencia: number;
    /** Antigüedad en días */
    antiguedad_dias: number;
    /** Tendencia */
    tendencia: 'alcista' | 'bajista' | 'estable';
  }>;
  /** Alertas generadas */
  alertas: Array<{
    /** Mensaje */
    mensaje: string;
    /** Severidad */
    severidad: 'warning' | 'critical';
  }>;
}

/**
 * @typedef {Object} PaymentEfficiencyRequest
 * @description Request para el endpoint de eficiencia de pagos
 */
export interface PaymentEfficiencyRequest {
  /** Fecha de inicio */
  fecha_inicio: string;
  /** Fecha de fin */
  fecha_fin: string;
  /** Filtro por moneda */
  moneda?: string;
}

/**
 * @typedef {Object} PaymentEfficiencyResponse
 * @description Response del endpoint de eficiencia de pagos
 */
export interface PaymentEfficiencyResponse {
  /** Transacciones con spreads */
  transacciones: Array<{
    /** Fecha */
    fecha: string;
    /** Moneda */
    moneda: string;
    /** Monto */
    monto: number;
    /** Tasa oficial */
    tasa_oficial: number;
    /** Tasa real */
    tasa_real: number;
    /** Spread bancario */
    spread_bancario: number;
  }>;
  /** Spread promedio ponderado */
  spread_promedio: number;
  /** Mejor tasa obtenida */
  mejor_tasa: number;
  /** Peor tasa obtenida */
  peor_tasa: number;
  /** Transacciones con spread superior al promedio */
  transacciones_superiores_promedio: Array<{
    /** Fecha */
    fecha: string;
    /** Moneda */
    moneda: string;
    /** Monto */
    monto: number;
    /** Tasa oficial */
    tasa_oficial: number;
    /** Tasa real */
    tasa_real: number;
    /** Spread bancario */
    spread_bancario: number;
  }>;
  /** Flag de recomendación de renegociación */
  recomendacion_renegociacion: boolean;
}

/**
 * @typedef {Object} KPIsRequest
 * @description Request para el endpoint de KPIs
 */
export interface KPIsRequest {
  /** Fecha de inicio */
  fecha_inicio: string;
  /** Fecha de fin */
  fecha_fin: string;
}

/**
 * @typedef {Object} KPIsResponse
 * @description Response del endpoint de KPIs
 */
export interface KPIsResponse {
  /** Tasa de equilibrio */
  tasa_equilibrio: Array<{
    /** ID del producto */
    producto_id: string;
    /** Nombre */
    nombre: string;
    /** Tasa de equilibrio */
    tasa_equilibrio: number;
    /** Tasa actual */
    tasa_actual: number;
    /** Proximidad porcentual */
    proximidad_porcentaje: number;
    /** Estado */
    estado: 'seguro' | 'advertencia' | 'critico';
  }>;
  /** Margen real vs nominal */
  margen_real_vs_nominal: {
    /** Margen nominal */
    margen_nominal: number;
    /** Margen real */
    margen_real: number;
    /** Diferencia porcentual */
    diferencia_porcentual: number;
    /** Tendencia histórica */
    tendencia_historica: Array<{
      /** Fecha */
      fecha: string;
      /** Margen nominal */
      margen_nominal: number;
      /** Margen real */
      margen_real: number;
    }>;
  };
  /** Diferencial cambiario acumulado */
  diferencial_cambiario_acumulado: {
    /** YTD */
    ytd: number;
    /** Desglose mensual */
    desglose_mensual: Array<{
      /** Mes */
      mes: string;
      /** Diferencial */
      diferencial: number;
    }>;
    /** Comparación con año anterior */
    comparacion_anio_anterior: number;
  };
  /** Envejecimiento de deuda */
  envejecimiento_deuda: Array<{
    /** ID de la deuda */
    deuda_id: string;
    /** Entidad */
    entidad: string;
    /** Moneda */
    moneda: string;
    /** Monto */
    monto: number;
    /** Antigüedad en días */
    antiguedad_dias: number;
    /** Tendencia de la moneda */
    tendencia_moneda: 'alcista' | 'bajista' | 'estable';
    /** Prioridad */
    prioridad: number;
    /** Impacto 30 días */
    impacto_30_dias: number;
  }>;
}

/**
 * @typedef {Object} SimulateScenarioRequest
 * @description Request para el endpoint de simulación de escenarios
 */
export interface SimulateScenarioRequest {
  /** Tasas simuladas por moneda */
  tasas_simuladas: Record<string, number>;
  /** Fecha de proyección */
  fecha_proyeccion: string;
}

/**
 * @typedef {Object} SimulateScenarioResponse
 * @description Response del endpoint de simulación de escenarios
 */
export interface SimulateScenarioResponse {
  /** Costo de reposición proyectado */
  costo_reposicion_proyectado: number;
  /** Pérdida no realizada proyectada */
  perdida_no_realizada_proyectada: number;
  /** Margen real proyectado */
  margen_real_proyectado: number;
  /** Utilidad neta proyectada */
  utilidad_neta_proyectada: number;
  /** Alertas generadas */
  alertas_generadas: Array<{
    /** Tipo */
    tipo: string;
    /** Mensaje */
    mensaje: string;
    /** Severidad */
    severidad: 'info' | 'warning' | 'critical';
  }>;
}

// ========== ESTADOS DE REDUX ==========

/**
 * @typedef {Object} ExchangeIntelligenceState
 * @description Estado completo del slice de Redux para Exchange Intelligence
 */
export interface ExchangeIntelligenceState {
  /** Datos de impacto en costos */
  cost_impact: CostImpactResponse | null;
  /** Datos de exposición de deuda */
  debt_exposure: DebtExposureResponse | null;
  /** Datos de eficiencia de pagos */
  payment_efficiency: PaymentEfficiencyResponse | null;
  /** Datos de KPIs */
  kpis: KPIData | null;
  /** Resultado de simulación */
  simulation_result: SimulationResult | null;
  /** Estados de carga */
  loading: {
    /** Carga de impacto en costos */
    cost_impact: boolean;
    /** Carga de exposición de deuda */
    debt_exposure: boolean;
    /** Carga de eficiencia de pagos */
    payment_efficiency: boolean;
    /** Carga de KPIs */
    kpis: boolean;
    /** Carga de simulación */
    simulation: boolean;
  };
  /** Estados de error */
  errors: {
    /** Error de impacto en costos */
    cost_impact: string | null;
    /** Error de exposición de deuda */
    debt_exposure: string | null;
    /** Error de eficiencia de pagos */
    payment_efficiency: string | null;
    /** Error de KPIs */
    kpis: string | null;
    /** Error de simulación */
    simulation: string | null;
  };
  /** Filtros aplicados */
  filters: {
    /** Fecha de inicio */
    fecha_inicio: string;
    /** Fecha de fin */
    fecha_fin: string;
    /** Categoría */
    categoria_id?: string;
    /** Almacén */
    almacen_id?: string;
    /** Proveedor */
    vendor_id?: string;
    /** Moneda */
    moneda?: string;
  };
  /** Umbrales personalizados */
  custom_thresholds: {
    /** Umbral de incremento de costos */
    cost_increase_alert: number;
    /** Umbral de pérdida no realizada */
    debt_exposure_alert: number;
    /** Umbral de spread bancario */
    spread_alert: number;
    /** Umbral de proximidad a equilibrio (advertencia) */
    break_even_warning: number;
    /** Umbral de proximidad a equilibrio (crítico) */
    break_even_critical: number;
    /** Umbral de diferencia de márgenes */
    margin_alert: number;
    /** Umbral de diferencial cambiario */
    differential_alert: number;
    /** Umbral de tendencia de moneda */
    currency_trend_alert: number;
  };
}

// ========== ESTRUCTURAS DE DATOS CALCULADAS ==========

/**
 * @typedef {Object} BreakEvenExchangeRate
 * @description Estructura para cálculo de Tasa de Equilibrio
 */
export interface BreakEvenExchangeRate {
  /** ID del producto */
  producto_id: string;
  /** Precio de venta */
  precio_venta: number;
  /** Gastos fijos */
  gastos_fijos: number;
  /** Costo en divisa */
  costo_divisa: number;
  /** Tasa de equilibrio calculada */
  tasa_equilibrio: number;
}

/**
 * @typedef {Object} RealMargin
 * @description Estructura para cálculo de Margen Real
 */
export interface RealMargin {
  /** ID del producto */
  producto_id: string;
  /** Margen nominal */
  margen_nominal: number;
  /** Costo ajustado por tasa actual */
  costo_ajustado: number;
  /** Margen real */
  margen_real: number;
  /** Diferencia porcentual */
  diferencia_porcentual: number;
}

/**
 * @typedef {Object} ExchangeDifferential
 * @description Estructura para Diferencial Cambiario
 */
export interface ExchangeDifferential {
  /** Período */
  periodo: string;
  /** Ingresos nominales */
  ingresos_nominales: number;
  /** Ingresos ajustados */
  ingresos_ajustados: number;
  /** Gastos nominales */
  gastos_nominales: number;
  /** Gastos ajustados */
  gastos_ajustados: number;
  /** Diferencial calculado */
  diferencial: number;
  /** Desglose mensual */
  desglose_mensual?: Array<{
    /** Mes */
    mes: string;
    /** Diferencial del mes */
    diferencial: number;
  }>;
  /** Comparación con año anterior */
  comparacion_anio_anterior?: number;
}

/**
 * @typedef {Object} DebtPriority
 * @description Estructura para Priorización de Deuda
 */
export interface DebtPriority {
  /** ID de la deuda */
  deuda_id: string;
  /** Monto */
  monto: number;
  /** Moneda */
  moneda: string;
  /** Antigüedad en días */
  antiguedad_dias: number;
  /** Tendencia 30 días */
  tendencia_30d: number;
  /** Score de prioridad */
  score_prioridad: number;
}