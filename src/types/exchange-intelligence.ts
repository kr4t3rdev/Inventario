/**
 * @description Tipos e interfaces para el Dashboard de Inteligencia Cambiaria
 * Este archivo contiene todas las definiciones de tipos para el sistema de análisis cambiario
 */

// ============================================================================
// TIPOS BASE Y ENUMS
// ============================================================================

/**
 * @description Estados posibles para productos según proximidad a tasa de equilibrio
 */
export type ProductoEstado = 'seguro' | 'advertencia' | 'critico'

/**
 * @description Tendencias de moneda basadas en análisis de 30 días
 */
export type TendenciaMoneda = 'alcista' | 'bajista' | 'estable'

/**
 * @description Niveles de severidad para alertas
 */
export type SeveridadAlerta = 'info' | 'warning' | 'critical'

/**
 * @description Tipos de alertas del sistema
 */
export type TipoAlerta = 
  | 'incremento_costos'
  | 'perdida_no_realizada'
  | 'spread_bancario'
  | 'proximidad_equilibrio'
  | 'diferencia_margenes'
  | 'diferencial_cambiario'
  | 'tendencia_deuda'
  | 'cambio_tasa_diario'

// ============================================================================
// INTERFACES DE DATOS - SECCIÓN A: IMPACTO EN COSTOS
// ============================================================================

/**
 * @description Punto de datos en la línea de tiempo de impacto en costos
 */
export interface CostImpactTimelinePoint {
  fecha: string
  costo_historico: number
  costo_reposicion: number
  diferencia_porcentual: number
  productos_afectados: number
}

/**
 * @description Resumen del análisis de impacto en costos
 */
export interface CostImpactResumen {
  incremento_promedio: number
  productos_afectados: number
  alerta_ajuste_precios: boolean
  costo_historico_total: number
  costo_reposicion_total: number
}

/**
 * @description Datos completos de impacto en costos de inventario
 */
export interface CostImpactData {
  timeline: CostImpactTimelinePoint[]
  resumen: CostImpactResumen
}

// ============================================================================
// INTERFACES DE DATOS - SECCIÓN B: EXPOSICIÓN DE DEUDA
// ============================================================================

/**
 * @description Desglose de deuda por moneda extranjera
 */
export interface DeudaPorMoneda {
  moneda: string
  monto_original: number
  monto_actual: number
  diferencia: number
  antiguedad_dias: number
  tendencia: TendenciaMoneda
  numero_deudas: number
}

/**
 * @description Detalle de una deuda individual
 */
export interface DeudaDetalle {
  deuda_id: string
  entidad: string
  moneda: string
  monto: number
  monto_local_original: number
  monto_local_actual: number
  tasa_original: number
  tasa_actual: number
  fecha_registro: string
  antiguedad_dias: number
  tendencia_moneda: TendenciaMoneda
  evolucion_historica?: Array<{
    fecha: string
    monto_local: number
    tasa: number
  }>
}

/**
 * @description Datos completos de exposición de deuda
 */
export interface DebtExposureData {
  deuda_original_local: number
  deuda_actual_local: number
  perdida_no_realizada: number
  perdida_porcentual: number
  desglose_por_moneda: DeudaPorMoneda[]
  deudas_detalle?: DeudaDetalle[]
}

// ============================================================================
// INTERFACES DE DATOS - SECCIÓN C: EFICIENCIA DE PAGOS
// ============================================================================

/**
 * @description Transacción de cambio con análisis de spread
 */
export interface TransaccionCambio {
  id: string
  fecha: string
  moneda: string
  monto: number
  tasa_oficial: number
  tasa_real: number
  spread_bancario: number
  superior_promedio: boolean
}

/**
 * @description Métricas de eficiencia de pagos
 */
export interface PaymentEfficiencyMetrics {
  spread_promedio_ponderado: number
  mejor_tasa: number
  peor_tasa: number
  total_transacciones: number
  volumen_total: number
  ahorro_potencial: number
}

/**
 * @description Datos completos de eficiencia de pagos
 */
export interface PaymentEfficiencyData {
  transacciones: TransaccionCambio[]
  metricas: PaymentEfficiencyMetrics
  recomendacion_renegociacion: boolean
}

// ============================================================================
// INTERFACES DE KPIs
// ============================================================================

/**
 * @description Producto con análisis de tasa de equilibrio
 */
export interface ProductoTasaEquilibrio {
  producto_id: string
  nombre: string
  codigo?: string
  categoria?: string
  precio_venta: number
  costo_divisa: number
  gastos_fijos: number
  tasa_equilibrio: number
  tasa_actual: number
  proximidad_porcentaje: number
  estado: ProductoEstado
  margen_seguridad: number
}

/**
 * @description KPI de Tasa de Equilibrio
 */
export interface TasaEquilibrioKPI {
  productos: ProductoTasaEquilibrio[]
  productos_criticos: number
  productos_advertencia: number
  productos_seguros: number
  tasa_promedio_equilibrio: number
}

/**
 * @description Punto en la tendencia histórica de márgenes
 */
export interface MargenHistoricoPoint {
  fecha: string
  margen_nominal: number
  margen_real: number
  diferencia: number
}

/**
 * @description KPI de Margen Real vs Nominal
 */
export interface MargenRealVsNominalKPI {
  margen_nominal: number
  margen_real: number
  diferencia_porcentual: number
  diferencia_absoluta: number
  tendencia_historica: MargenHistoricoPoint[]
  alerta_diferencia: boolean
}

/**
 * @description Desglose mensual del diferencial cambiario
 */
export interface DiferencialMensual {
  mes: string
  diferencial: number
  ingresos: number
  gastos: number
  porcentaje_ingresos: number
}

/**
 * @description KPI de Diferencial Cambiario Acumulado
 */
export interface DiferencialCambiarioKPI {
  ytd: number
  ytd_porcentaje_ingresos: number
  desglose_mensual: DiferencialMensual[]
  comparacion_anio_anterior: number
  comparacion_porcentual: number
  alerta_cobertura: boolean
}

/**
 * @description Deuda priorizada para pago
 */
export interface DeudaPriorizada {
  deuda_id: string
  entidad: string
  moneda: string
  monto: number
  monto_local: number
  antiguedad_dias: number
  tendencia_moneda: TendenciaMoneda
  tendencia_porcentaje: number
  prioridad: number
  impacto_30_dias: number
  impacto_porcentual: number
  fecha_vencimiento?: string
}

/**
 * @description KPI de Envejecimiento de Deuda
 */
export interface EnvejecimientoDeudaKPI {
  deudas_priorizadas: DeudaPriorizada[]
  total_deudas: number
  deudas_urgentes: number
  impacto_total_30_dias: number
}

/**
 * @description Todos los KPIs del dashboard
 */
export interface KPIData {
  tasa_equilibrio: TasaEquilibrioKPI
  margen_real_vs_nominal: MargenRealVsNominalKPI
  diferencial_cambiario_acumulado: DiferencialCambiarioKPI
  envejecimiento_deuda: EnvejecimientoDeudaKPI
}

// ============================================================================
// INTERFACES DE ALERTAS
// ============================================================================

/**
 * @description Alerta del sistema
 */
export interface Alerta {
  id: string
  tipo: TipoAlerta
  mensaje: string
  severidad: SeveridadAlerta
  fecha_generacion: string
  valor_actual: number
  umbral: number
  entidad_afectada?: string
  accion_recomendada?: string
  leida: boolean
}

/**
 * @description Configuración de umbrales personalizados
 */
export interface UmbralesPersonalizados {
  cost_increase_alert: number // default: 10
  debt_exposure_alert: number // default: 5
  spread_alert: number // default: 3
  break_even_warning: number // default: 90
  break_even_critical: number // default: 100
  margin_alert: number // default: 15
  differential_alert: number // default: 5
  currency_trend_alert: number // default: 5
}

// ============================================================================
// INTERFACES DE SIMULACIÓN
// ============================================================================

/**
 * @description Tasas simuladas por moneda
 */
export interface TasasSimuladas {
  [moneda: string]: number
}

/**
 * @description Resultado de simulación de escenario
 */
export interface SimulationResult {
  costo_reposicion_proyectado: number
  costo_reposicion_actual: number
  cambio_costo_porcentual: number
  perdida_no_realizada_proyectada: number
  perdida_no_realizada_actual: number
  cambio_perdida_porcentual: number
  margen_real_proyectado: number
  margen_real_actual: number
  cambio_margen_porcentual: number
  utilidad_neta_proyectada: number
  utilidad_neta_actual: number
  cambio_utilidad_porcentual: number
  alertas_generadas: Alerta[]
  kpis_afectados: string[]
}

/**
 * @description Escenario guardado
 */
export interface EscenarioGuardado {
  id: string
  nombre: string
  descripcion?: string
  tasasSimuladas: TasasSimuladas
  fechaProyeccion: string
  resultados: SimulationResult
  alertas?: Alerta[]
  etiquetas?: string[]
  esFavorito: boolean
  creadoPor: string
  fechaCreacion: string
  ultimaModificacion: string
}

/**
 * @description Escenario predefinido
 */
export interface EscenarioPredefinido {
  id: string
  nombre: string
  descripcion: string
  ajuste_porcentual: number // +10, -10, etc.
}

/**
 * @description Lista de escenarios con paginación
 */
export interface ListaEscenariosResponse {
  escenarios: EscenarioGuardado[]
  total: number
  limit: number
  offset: number
}

// ============================================================================
// INTERFACES DE FILTROS
// ============================================================================

/**
 * @description Filtros globales del dashboard
 */
export interface FiltrosDashboard {
  fecha_inicio: string
  fecha_fin: string
  categoria_id?: string
  almacen_id?: string
  vendor_id?: string
  moneda?: string
}

/**
 * @description Opciones de filtro disponibles
 */
export interface OpcionesFiltro {
  categorias: Array<{ id: string; nombre: string }>
  almacenes: Array<{ id: string; nombre: string }>
  vendors: Array<{ id: string; nombre: string }>
  monedas: Array<{ codigo: string; nombre: string }>
}

// ============================================================================
// INTERFACES DE EXPORTACIÓN
// ============================================================================

/**
 * @description Formato de exportación
 */
export type FormatoExportacion = 'pdf' | 'csv' | 'excel'

/**
 * @description Configuración de exportación
 */
export interface ConfiguracionExportacion {
  formato: FormatoExportacion
  incluir_graficos: boolean
  incluir_alertas: boolean
  incluir_recomendaciones: boolean
  incluir_resumen_ejecutivo: boolean
  secciones: Array<'cost_impact' | 'debt_exposure' | 'payment_efficiency' | 'kpis'>
}

/**
 * @description Reporte exportado
 */
export interface ReporteExportado {
  id: string
  fecha_generacion: string
  formato: FormatoExportacion
  nombre_archivo: string
  url_descarga: string
  generado_por: string
  filtros_aplicados: FiltrosDashboard
}

// ============================================================================
// INTERFACES DE API - REQUESTS
// ============================================================================

/**
 * @description Request para análisis de impacto en costos
 */
export interface CostImpactRequest {
  fecha_inicio: string
  fecha_fin: string
  categoria_id?: string
  almacen_id?: string
  vendor_id?: string
}

/**
 * @description Request para análisis de exposición de deuda
 */
export interface DebtExposureRequest {
  fecha_corte?: string
  incluir_detalle?: boolean
}

/**
 * @description Request para análisis de eficiencia de pagos
 */
export interface PaymentEfficiencyRequest {
  fecha_inicio: string
  fecha_fin: string
  moneda?: string
}

/**
 * @description Request para obtener KPIs
 */
export interface KPIsRequest {
  fecha_inicio: string
  fecha_fin: string
}

/**
 * @description Request para simular escenario
 */
export interface SimulateScenarioRequest {
  tasas_simuladas: TasasSimuladas
  fecha_proyeccion: string
}

/**
 * @description Request para guardar escenario
 */
export interface GuardarEscenarioRequest {
  nombre: string
  descripcion?: string
  tasas_simuladas: TasasSimuladas
  fecha_proyeccion: string
}

/**
 * @description Request para exportar reporte
 */
export interface ExportarReporteRequest {
  configuracion: ConfiguracionExportacion
  filtros: FiltrosDashboard
}

// ============================================================================
// INTERFACES DE API - RESPONSES
// ============================================================================

/**
 * @description Response de análisis de impacto en costos
 */
export interface CostImpactResponse {
  success: boolean
  data: CostImpactData
  alertas: Alerta[]
  timestamp: string
}

/**
 * @description Response de análisis de exposición de deuda
 */
export interface DebtExposureResponse {
  success: boolean
  data: DebtExposureData
  alertas: Alerta[]
  timestamp: string
}

/**
 * @description Response de análisis de eficiencia de pagos
 */
export interface PaymentEfficiencyResponse {
  success: boolean
  data: PaymentEfficiencyData
  alertas: Alerta[]
  timestamp: string
}

/**
 * @description Response de KPIs
 */
export interface KPIsResponse {
  success: boolean
  data: KPIData
  alertas: Alerta[]
  timestamp: string
}

/**
 * @description Response de simulación de escenario
 */
export interface SimulateScenarioResponse {
  success: boolean
  data: SimulationResult
  timestamp: string
}

/**
 * @description Response de guardar escenario
 */
export interface GuardarEscenarioResponse {
  success: boolean
  data: EscenarioGuardado
  message: string
}

/**
 * @description Response de exportar reporte
 */
export interface ExportarReporteResponse {
  success: boolean
  data: ReporteExportado
  message: string
}

/**
 * @description Response de error de API
 */
export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
  timestamp: string
}

// ============================================================================
// INTERFACES DE ESTADO REDUX
// ============================================================================

/**
 * @description Estados de carga por sección
 */
export interface LoadingStates {
  cost_impact: boolean
  debt_exposure: boolean
  payment_efficiency: boolean
  kpis: boolean
  simulation: boolean
  export: boolean
}

/**
 * @description Estados de error por sección
 */
export interface ErrorStates {
  cost_impact: string | null
  debt_exposure: string | null
  payment_efficiency: string | null
  kpis: string | null
  simulation: string | null
  export: string | null
}

/**
 * @description Estado completo de Redux para Exchange Intelligence
 */
export interface ExchangeIntelligenceState {
  // Datos
  cost_impact: CostImpactData | null
  debt_exposure: DebtExposureData | null
  payment_efficiency: PaymentEfficiencyData | null
  kpis: KPIData | null
  simulation_result: SimulationResult | null
  
  // Alertas
  alertas: Alerta[]
  alertas_no_leidas: number
  
  // Escenarios
  escenarios_guardados: EscenarioGuardado[]
  escenario_actual: EscenarioGuardado | null
  
  // Reportes
  reportes_generados: ReporteExportado[]
  
  // Estados de UI
  loading: LoadingStates
  errors: ErrorStates
  
  // Filtros y configuración
  filtros: FiltrosDashboard
  opciones_filtro: OpcionesFiltro | null
  custom_thresholds: UmbralesPersonalizados
  
  // Metadata
  ultima_actualizacion: string | null
  seccion_activa: 'cost_impact' | 'debt_exposure' | 'payment_efficiency' | 'kpis' | 'simulator'
}

// ============================================================================
// INTERFACES DE COMPONENTES
// ============================================================================

/**
 * @description Props del componente principal del dashboard
 */
export interface ExchangeIntelligenceDashboardProps {
  fecha_inicio?: string
  fecha_fin?: string
  className?: string
}

/**
 * @description Props del componente de impacto en costos
 */
export interface CostImpactSectionProps {
  data: CostImpactData | null
  loading: boolean
  error: string | null
  filtros: FiltrosDashboard
  on_filtro_change: (filtros: Partial<FiltrosDashboard>) => void
}

/**
 * @description Props del componente de exposición de deuda
 */
export interface DebtExposureSectionProps {
  data: DebtExposureData | null
  loading: boolean
  error: string | null
  fecha_corte?: string
  on_fecha_change: (fecha: string) => void
  on_deuda_select: (deuda_id: string) => void
}

/**
 * @description Props del componente de eficiencia de pagos
 */
export interface PaymentEfficiencySectionProps {
  data: PaymentEfficiencyData | null
  loading: boolean
  error: string | null
  filtros: FiltrosDashboard
  on_filtro_change: (filtros: Partial<FiltrosDashboard>) => void
}

/**
 * @description Props del componente de KPIs
 */
export interface KPIDashboardProps {
  data: KPIData | null
  loading: boolean
  error: string | null
  filtros: FiltrosDashboard
}

/**
 * @description Props del componente de simulador
 */
export interface ScenarioSimulatorProps {
  datos_actuales: KPIData | null
  tasas_actuales: Record<string, number>
  on_simulate: (tasas: TasasSimuladas) => void
  on_save_scenario: (nombre: string, descripcion?: string) => void
  simulation_result: SimulationResult | null
  loading: boolean
}

/**
 * @description Props del componente de alertas
 */
export interface AlertasPanelProps {
  alertas: Alerta[]
  on_alerta_click: (alerta_id: string) => void
  on_marcar_leida: (alerta_id: string) => void
  on_limpiar_todas: () => void
}

/**
 * @description Props del componente de configuración de umbrales
 */
export interface ConfiguracionUmbralesProps {
  umbrales: UmbralesPersonalizados
  on_umbral_change: (umbrales: Partial<UmbralesPersonalizados>) => void
  on_reset_defaults: () => void
}

// ============================================================================
// TIPOS AUXILIARES Y UTILIDADES
// ============================================================================

/**
 * @description Rango de fechas
 */
export interface DateRange {
  start: string
  end: string
}

/**
 * @description Tasa de cambio con metadata
 */
export interface TasaCambioConMetadata {
  moneda: string
  tasa: number
  fecha: string
  fuente: 'sistema' | 'oficial' | 'manual'
  confiabilidad: number
}

/**
 * @description Producto con historial de compras
 */
export interface ProductoConHistorial {
  id: string
  nombre: string
  codigo: string
  cantidad_actual: number
  costo_original: number
  moneda_compra: string
  tasa_original: number
  fecha_ultima_compra: string
  historial_compras: Array<{
    fecha: string
    cantidad: number
    costo_unitario: number
    tasa_cambio: number
  }>
}

/**
 * @description Deuda con historial de tasas
 */
export interface DeudaConHistorial {
  id: string
  entidad: string
  monto: number
  moneda: string
  tasa_original: number
  fecha_registro: string
  fecha_vencimiento?: string
  estado: 'ACTIVA' | 'PAGADA' | 'VENCIDA'
  historial_tasas: Array<{
    fecha: string
    tasa: number
    monto_local: number
  }>
}

/**
 * @description Resultado de validación
 */
export interface ValidationResult {
  valid: boolean
  errors: Array<{
    field: string
    message: string
  }>
}

/**
 * @description Opciones de paginación
 */
export interface PaginationOptions {
  page: number
  page_size: number
  total_items: number
  total_pages: number
}

/**
 * @description Response paginada genérica
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationOptions
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * @description Type guard para verificar si una respuesta es un error
 */
export function is_api_error_response(response: unknown): response is ApiErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === false &&
    'error' in response
  )
}

/**
 * @description Type guard para verificar si un valor es una tendencia válida
 */
export function is_tendencia_moneda(value: unknown): value is TendenciaMoneda {
  return value === 'alcista' || value === 'bajista' || value === 'estable'
}

/**
 * @description Type guard para verificar si un valor es un estado de producto válido
 */
export function is_producto_estado(value: unknown): value is ProductoEstado {
  return value === 'seguro' || value === 'advertencia' || value === 'critico'
}

/**
 * @description Type guard para verificar si un valor es una severidad de alerta válida
 */
export function is_severidad_alerta(value: unknown): value is SeveridadAlerta {
  return value === 'info' || value === 'warning' || value === 'critical'
}
