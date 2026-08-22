/** Datos de cobertura que acompañan al balance calculado. */
export interface FinancialCoverage {
  complete?: boolean;
  unresolvedCount?: number;
  unresolvedAmount?: number;
  parts?: unknown[];
}

/** Ecuación contable presentada en el resumen. */
export interface BalanceEquation {
  assets: number;
  liabilitiesAndEquity: number;
  difference: number;
  status: string;
}

/** Balance general normalizado para la pantalla. */
export interface BalanceData {
  activos: {
    efectivo: number;
    inventario: number;
    cuentasPorCobrar: number;
    total: number;
  };
  pasivos: {
    deudaExterna: number;
    cuentasPorPagar?: number;
    total: number;
  };
  patrimonio: {
    capitalSocial: number;
    resultadosAcumulados?: number;
    resultadoPeriodo?: number;
    utilidadEjercicio: number;
    total: number;
  };
  ecuacion?: BalanceEquation;
  cobertura?: FinancialCoverage;
  estimaciones?: unknown[];
  incidencias?: unknown[];
  monedaFuncional?: string;
  fechaCorte?: string;
  resultadoHasta?: string | null;
}

/** Línea mensual del estado de resultados. */
export interface MonthlyIncomeStatement {
  month: number;
  monthName?: string;
  totalIngresos: number;
  ventasCosto: number;
  gastosCompras: number;
  gastosSalarios: number;
  gastosGenerales: number;
  gastosMermas: number;
  totalGastos: number;
  utilidadNeta: number;
}

/** Estado de resultados anual y mensual. */
export interface IncomeStatementData {
  mensual: MonthlyIncomeStatement[];
  anual: {
    totalIngresos: number;
    gastosCompras: number;
    gastosSalarios: number;
    gastosGenerales: number;
    gastosMermas: number;
    totalGastos: number;
    utilidadNeta: number;
  };
  incidencias?: unknown[];
  estimaciones?: unknown[];
}

/** Respuesta financiera consumida por la vista. */
export interface FinancialData {
  balance: BalanceData;
  estadoResultados: IncomeStatementData;
  reporte: {
    origen: 'LIVE' | 'SNAPSHOT';
    provisional: boolean;
    fechaCorte: string;
    resultadoHasta: string | null;
    periodoId: string | null;
    integridad: 'VALID' | null;
    snapshotVersion: number | null;
  };
}

/** Período histórico aprobado que puede consultarse sin recalcular. */
export interface FinancialPeriod {
  periodId: string;
  code: string | null;
  year: number;
  cutoffAt: string;
  snapshotVersion: 2;
}
