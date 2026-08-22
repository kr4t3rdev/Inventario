import { z } from 'zod';

import { getCurrentBalance } from '@/features/contabilidad/services/current-balance-service';
import {
  getReconciledResultForYear,
  presentReconciledPeriod,
} from '@/features/contabilidad/services/reconciled-result-service';
import {
  resolveFinancialReport,
  type FinancialReportResolution,
} from '@/features/contabilidad/services/historical-financial-report-service';
import {
  getAccountingYear,
} from '@/lib/services/fecha-operacion-registry';

const MIN_ACCOUNTING_YEAR = 1900;
const MAX_ACCOUNTING_YEAR = 2200;

/** Schema de parámetros que reciben los adaptadores HTTP y Server Action. */
export const balanceResultsReportQuerySchema = z.object({
  year: z.coerce.number().int().min(MIN_ACCOUNTING_YEAR).max(MAX_ACCOUNTING_YEAR).optional(),
  cutoffAt: z.string().datetime({ offset: true }).transform((value) => new Date(value)).optional(),
  moneda: z.string().trim().min(3).max(5).regex(/^[A-Za-z]+$/).transform((value) => value.toUpperCase()).optional(),
}).strict();

const balanceResultsReportParamsSchema = z.object({
  tenantId: z.string().trim().min(1),
  year: z.number().int().min(MIN_ACCOUNTING_YEAR).max(MAX_ACCOUNTING_YEAR).optional(),
  cutoffAt: z.date().refine((value) => !Number.isNaN(value.getTime())).optional(),
  now: z.date().optional(),
  moneda: z.string().trim().regex(/^[A-Z]{3,5}$/i).optional(),
});

/** Parámetros internos para generar el reporte de balance y resultados. */
export interface BalanceResultsReportParams {
  tenantId: string;
  year?: number;
  cutoffAt?: Date;
  now?: Date;
  moneda?: string;
}

type CurrentBalance = Awaited<ReturnType<typeof getCurrentBalance>>;
type ReconciledResult = Awaited<ReturnType<typeof getReconciledResultForYear>>;
type AvailableReport = Extract<
  FinancialReportResolution<{ balance: CurrentBalance; result: ReconciledResult }>,
  { status: 'AVAILABLE' }
>;

/** Contrato común consumido por la web, API legacy y futuros clientes. */
export interface BalanceResultsReport {
  balance: {
    activos: {
      efectivo: number;
      inventario: number;
      inventarioDetalle: CurrentBalance['assets']['inventory'];
      cuentasPorCobrar: number;
      total: number;
    };
    pasivos: {
      deudaExterna: number;
      cuentasPorPagar: number;
      total: number;
    };
    patrimonio: {
      capitalSocial: number;
      resultadosAcumulados: number;
      resultadoPeriodo: number;
      utilidadEjercicio: number;
      total: number;
    };
    ecuacion: CurrentBalance['equation'];
    cobertura: CurrentBalance['coverage'];
    estimaciones: CurrentBalance['estimates'];
    incidencias: CurrentBalance['incidents'];
    monedaFuncional: string;
    fechaCorte: string;
    resultadoHasta: string | null;
  };
  estadoResultados: {
    mensual: Array<ReturnType<typeof presentReconciledPeriod>>;
    anual: ReturnType<typeof presentReconciledPeriod>;
    incidencias: ReconciledResult['incidents'];
    estimaciones: ReconciledResult['estimates'];
    monedaFuncional: string;
    zonaHoraria: string;
  };
  reporte: {
    origen: 'LIVE' | 'SNAPSHOT';
    provisional: boolean;
    fechaCorte: string;
    resultadoHasta: string | null;
    periodoId: string | null;
    integridad: 'VALID' | null;
    snapshotVersion: 2 | null;
  };
}

type BalanceResultsReportErrorCode =
  | 'TENANT_REQUIRED'
  | 'INVALID_YEAR'
  | 'INVALID_CUTOFF'
  | 'CURRENCY_NOT_SUPPORTED'
  | 'NO_HISTORICAL_EVIDENCE'
  | 'PERIOD_NOT_APPROVED'
  | 'LEGACY_INCOMPLETE'
  | 'INTEGRITY_FAILED';

/** Error de dominio que permite a los adaptadores conservar códigos HTTP consistentes. */
export class BalanceResultsReportError extends Error {
  constructor(
    message: string,
    public readonly code: BalanceResultsReportErrorCode,
    public readonly status: 400 | 403 | 409,
    public readonly periodId: string | null = null,
    public readonly snapshotVersion?: number,
  ) {
    super(message);
    this.name = 'BalanceResultsReportError';
  }
}

/**
 * @description Valida los parámetros que no pasan por un adaptador externo.
 * @param {BalanceResultsReportParams} params - Parámetros del reporte.
 * @param {Date} now - Instante que se usará para resolver el período actual.
 * @returns {void} No devuelve valor; lanza un error de dominio si el input no es válido.
 */
function validateReportParams(params: BalanceResultsReportParams, now: Date): void {
  const validation = balanceResultsReportParamsSchema.safeParse(params);
  if (!validation.success) {
    const field = validation.error.issues[0]?.path[0];
    if (field === 'tenantId') {
      throw new BalanceResultsReportError(
        'Selecciona una empresa para consultar el reporte',
        'TENANT_REQUIRED',
        403,
      );
    }
    if (field === 'year') {
      throw new BalanceResultsReportError(
        'El período contable no es válido',
        'INVALID_YEAR',
        400,
      );
    }
    if (field === 'cutoffAt' || field === 'now') {
      throw new BalanceResultsReportError(
        'La fecha de corte no es válida',
        'INVALID_CUTOFF',
        400,
      );
    }
    throw new BalanceResultsReportError(
      'La moneda funcional no es válida',
      'CURRENCY_NOT_SUPPORTED',
      400,
    );
  }

  if (Number.isNaN(now.getTime())) {
    throw new BalanceResultsReportError(
      'La fecha de corte no es válida',
      'INVALID_CUTOFF',
      400,
    );
  }
}

/**
 * @description Convierte una resolución disponible al contrato público del reporte.
 * @param {AvailableReport} report - Resolución live o snapshot validada.
 * @returns {BalanceResultsReport} Reporte con balance, resultado y procedencia.
 */
function presentBalanceResultsReport(report: AvailableReport): BalanceResultsReport {
  const currentBalance = report.balance as CurrentBalance;
  const result = report.result as ReconciledResult;
  const isSnapshot = report.origin === 'SNAPSHOT';

  return {
    balance: {
      activos: {
        efectivo: currentBalance.assets.cashAndBanks,
        inventario: currentBalance.assets.inventory.total,
        inventarioDetalle: currentBalance.assets.inventory,
        cuentasPorCobrar: currentBalance.assets.receivables,
        total: currentBalance.assets.total,
      },
      pasivos: {
        deudaExterna: currentBalance.liabilities.externalDebt,
        cuentasPorPagar: currentBalance.liabilities.payables,
        total: currentBalance.liabilities.total,
      },
      patrimonio: {
        capitalSocial: currentBalance.equity.capital,
        resultadosAcumulados: currentBalance.equity.retainedEarnings,
        resultadoPeriodo: currentBalance.equity.currentResult,
        utilidadEjercicio: currentBalance.equity.currentResult,
        total: currentBalance.equity.total,
      },
      ecuacion: currentBalance.equation,
      cobertura: currentBalance.coverage,
      estimaciones: currentBalance.estimates,
      incidencias: currentBalance.incidents,
      monedaFuncional: currentBalance.functionalCurrency,
      fechaCorte: report.cutoffAt,
      resultadoHasta: isSnapshot ? report.resultThrough : null,
    },
    estadoResultados: {
      mensual: result.monthly.map(presentReconciledPeriod),
      anual: presentReconciledPeriod(result.annual),
      incidencias: result.incidents,
      estimaciones: result.estimates,
      monedaFuncional: result.functionalCurrency,
      zonaHoraria: result.timeZone,
    },
    reporte: {
      origen: report.origin,
      provisional: report.provisional,
      fechaCorte: report.cutoffAt,
      resultadoHasta: isSnapshot ? report.resultThrough : null,
      periodoId: report.periodId,
      integridad: isSnapshot ? report.integrity : null,
      snapshotVersion: isSnapshot ? report.snapshotVersion : null,
    },
  };
}

/**
 * @description Obtiene balance y resultados desde una única resolución live/snapshot.
 * @param {BalanceResultsReportParams} params - Tenant, período y filtros del reporte.
 * @returns {Promise<BalanceResultsReport>} Contrato compartido para todos los clientes.
 */
export async function getBalanceResultsReport(
  params: BalanceResultsReportParams,
): Promise<BalanceResultsReport> {
  const now = params.cutoffAt ?? params.now ?? new Date();
  validateReportParams(params, now);
  const year = params.year ?? getAccountingYear(now);

  const report = await resolveFinancialReport({
    tenantId: params.tenantId,
    year,
    now,
    calculateLive: async (cutoffAt) => {
      const result = await getReconciledResultForYear({
        tenantId: params.tenantId,
        year,
        cutoffAt,
      });
      const balance = await getCurrentBalance({
        tenantId: params.tenantId,
        asOf: cutoffAt,
        currentResult: result.annual.reconciledResult,
        currentResultYear: year,
      });
      return { balance, result };
    },
  });

  if (report.status === 'UNAVAILABLE') {
    throw new BalanceResultsReportError(
      'No existe evidencia histórica suficiente para consultar este período',
      report.reason,
      409,
      report.periodId,
      report.snapshotVersion,
    );
  }

  const presented = presentBalanceResultsReport(report);
  if (
    params.moneda &&
    presented.balance.monedaFuncional !== params.moneda.trim().toUpperCase()
  ) {
    throw new BalanceResultsReportError(
      'La moneda solicitada no coincide con la moneda funcional de la empresa',
      'CURRENCY_NOT_SUPPORTED',
      400,
    );
  }

  return presented;
}
