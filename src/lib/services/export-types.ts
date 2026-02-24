/**
 * Tipos para el servicio de exportación de datos
 * @description Definiciones de tipos utilizados en la exportación de datos del Dashboard de Inteligencia Cambiaria
 */

/**
 * Formatos de exportación disponibles
 */
export type ExportFormat = "csv" | "excel" | "json" | "text";

/**
 * Opciones de configuración para la exportación
 */
export interface ExportOptions {
  includeHeaders: boolean;
  decimalSeparator: string;
  thousandSeparator: string;
  dateFormat: string;
  title?: string;
}

/**
 * Resultado de una operación de exportación
 */
export interface ExportResult {
  content: string;
  filename: string;
  mimeType: string;
  format: ExportFormat;
  size: number;
  timestamp: string;
}

/**
 * Configuración de columna para exportación
 */
export interface ExportColumn {
  key: string;
  header: string;
  type: "string" | "number" | "currency" | "date" | "boolean" | "json";
}

/**
 * Registro aplanado para exportación
 */
export interface FlatExportRecord {
  tipo: string;
  metric: string;
  valor: unknown;
}

/**
 * Datos de KPIs para exportación
 */
export interface KpiData {
  currency: string;
  totalExposure: number;
  avgExchangeRate: number;
  totalDebtUsd: number;
  riskScore: number;
  hedgingCoverage: number;
  date: string;
}

/**
 * Datos de escenario simulado para exportación
 */
export interface ScenarioSimulation {
  id: string;
  name: string;
  description?: string;
  depreciationRate: number;
  inflationRate: number;
  interestRateChange: number;
  totalImpact: number;
  adjustedDebt: number;
  currency: string;
  createdAt: string;
}

/**
 * Datos de impacto de costos para exportación
 */
export interface CostImpactData {
  date: string;
  totalCostIncrease: number;
  currency: string;
}

/**
 * Datos de exposición de deuda para exportación
 */
export interface DebtExposureData {
  date: string;
  shortTermDebt: number;
  longTermDebt: number;
  currency: string;
}

/**
 * Datos de eficiencia de pagos para exportación
 */
export interface PaymentEfficiencyData {
  date: string;
  onTimePayments: number;
  earlyPaymentDiscounts: number;
  latePaymentPenalties: number;
  currency: string;
}
