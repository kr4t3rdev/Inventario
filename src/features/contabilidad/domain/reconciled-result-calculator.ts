import {
  classifyReconciliation,
  type ReconciliationStatus,
} from '@/features/contabilidad/domain/reconciliation-policy';

interface RevenueDocument {
  id: string;
  revenue: number;
  historicalCost: number;
  estimatedCost: number;
}

interface MovementBase {
  id: string;
  occurredAt: Date | string;
  amount: number;
  status: ReconciliationStatus;
}

export interface SaleResultMovement extends MovementBase {
  source: 'sale';
  kind: 'SALE';
  document: RevenueDocument;
}

export interface ServiceResultMovement extends MovementBase {
  source: 'service';
  kind: 'SERVICE_SALE';
  document: RevenueDocument;
}

export interface ExpenseResultMovement extends MovementBase {
  source: 'expense';
  kind:
    | 'SALARY_EXPENSE'
    | 'GENERAL_EXPENSE'
    | 'RECEIVED_SERVICE_EXPENSE'
    | 'SOLD_SERVICE_COST'
    | 'INVENTORY_PURCHASE';
  documentId: string;
  documentAmount: number;
  capAmount?: number;
}

export interface FinancialResultMovement extends MovementBase {
  source: 'financial';
  kind:
    | 'CASH_LOAN_DISBURSEMENT'
    | 'CASH_LOAN_PAYMENT'
    | 'CASH_DEBT_DISBURSEMENT'
    | 'CASH_DEBT_PAYMENT'
    | 'EXTERNAL_DEBT_RECEIPT';
}

export type ReconciledResultMovement =
  | SaleResultMovement
  | ServiceResultMovement
  | ExpenseResultMovement
  | FinancialResultMovement;

export interface ShrinkageAdjustment {
  id: string;
  occurredAt: Date | string;
  amount: number;
}

export type OpeningRecognition =
  | { source: 'sale' | 'service'; documentId: string; amount: number }
  | {
      source: 'expense';
      kind: ExpenseResultMovement['kind'];
      documentId: string;
      amount: number;
    };

export interface ReconciledResultIncident {
  code:
    | 'INVALID_AMOUNT'
    | 'INVALID_DATE'
    | 'INVALID_DOCUMENT_TOTAL'
    | 'PAYMENT_EXCEEDS_DOCUMENT';
  movementId: string;
  affectedAmount: number;
}

export interface ReconciledResultEstimate {
  code: 'CURRENT_COST_FALLBACK';
  movementId: string;
  affectedAmount: number;
}

export interface ReconciledPeriodResult {
  income: { sales: number; services: number; total: number };
  costOfSales: {
    productsHistorical: number;
    productsEstimated: number;
    services: number;
    total: number;
  };
  grossMargin: number;
  operatingExpenses: {
    salaries: number;
    general: number;
    purchasedServices: number;
    total: number;
  };
  inventoryPurchases: number;
  nonCashAdjustments: { shrinkages: number };
  reconciledResult: number;
  cashFlow: { operating: number; financial: number; net: number };
}

export interface MonthlyReconciledResult extends ReconciledPeriodResult {
  month: number;
}

export interface CalculateReconciledResultInput {
  year: number;
  timeZone: string;
  functionalCurrency: string;
  movements: ReconciledResultMovement[];
  shrinkages: ShrinkageAdjustment[];
  openingRecognitions?: OpeningRecognition[];
}

export interface ReconciledResult {
  year: number;
  timeZone: string;
  functionalCurrency: string;
  monthly: MonthlyReconciledResult[];
  annual: ReconciledPeriodResult;
  incidents: ReconciledResultIncident[];
  estimates: ReconciledResultEstimate[];
}

interface DocumentProgress {
  recognized: number;
  historicalCost: number;
  estimatedCost: number;
  costInitialized: boolean;
}

/**
 * @description Crea un período vacío con todas las partidas reconstruibles del resultado.
 * @returns {ReconciledPeriodResult} Período inicializado en cero.
 */
function createEmptyPeriod(): ReconciledPeriodResult {
  return {
    income: { sales: 0, services: 0, total: 0 },
    costOfSales: { productsHistorical: 0, productsEstimated: 0, services: 0, total: 0 },
    grossMargin: 0,
    operatingExpenses: { salaries: 0, general: 0, purchasedServices: 0, total: 0 },
    inventoryPurchases: 0,
    nonCashAdjustments: { shrinkages: 0 },
    reconciledResult: 0,
    cashFlow: { operating: 0, financial: 0, net: 0 },
  };
}

/**
 * @description Recalcula subtotales derivados únicamente desde partidas de detalle.
 * @param {ReconciledPeriodResult} period - Período que se actualizará.
 * @returns {void} No devuelve valor; actualiza el período recibido.
 */
function calculatePeriodTotals(period: ReconciledPeriodResult): void {
  period.income.total = period.income.sales + period.income.services;
  period.costOfSales.total = period.costOfSales.productsHistorical +
    period.costOfSales.productsEstimated + period.costOfSales.services;
  period.grossMargin = period.income.total - period.costOfSales.total;
  period.operatingExpenses.total = period.operatingExpenses.salaries +
    period.operatingExpenses.general + period.operatingExpenses.purchasedServices;
  period.reconciledResult = period.grossMargin - period.operatingExpenses.total;
  period.cashFlow.net = period.cashFlow.operating + period.cashFlow.financial;
}

/**
 * @description Obtiene año y mes civil de un instante en una zona IANA.
 * @param {Date} date - Instante UTC que se desea ubicar.
 * @param {string} timeZone - Zona horaria IANA.
 * @returns {{year: number, month: number}} Año y mes locales.
 */
function getZonedYearMonth(date: Date, timeZone: string): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  return { year, month };
}

/**
 * @description Convierte la medianoche civil de una zona IANA a un instante UTC.
 * @param {number} year - Año civil.
 * @param {number} month - Mes civil entre 1 y 12.
 * @param {number} day - Día civil.
 * @param {string} timeZone - Zona horaria IANA.
 * @returns {Date} Instante UTC equivalente.
 */
function zonedMidnightToUtc(year: number, month: number, day: number, timeZone: string): Date {
  const target = Date.UTC(year, month - 1, day);
  let candidate = new Date(target);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = formatter.formatToParts(candidate);
    const value = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    const representedAsUtc = Date.UTC(
      value('year'),
      value('month') - 1,
      value('day'),
      value('hour'),
      value('minute'),
      value('second'),
    );
    candidate = new Date(target - (representedAsUtc - candidate.getTime()));
  }

  return candidate;
}

/**
 * @description Construye el rango anual semiabierto en la zona horaria del reporte.
 * @param {number} year - Año civil solicitado.
 * @param {string} timeZone - Zona horaria IANA.
 * @returns {{gte: Date, lt: Date}} Inicio inclusivo y fin exclusivo en UTC.
 */
export function getYearRangeInTimeZone(
  year: number,
  timeZone: string,
): { gte: Date; lt: Date } {
  return {
    gte: zonedMidnightToUtc(year, 1, 1, timeZone),
    lt: zonedMidnightToUtc(year + 1, 1, 1, timeZone),
  };
}

/**
 * @description Limita un cobro o pago al saldo pendiente de su documento.
 * @param {ReconciledResultMovement} movement - Movimiento que se reconocerá.
 * @param {string} documentId - Documento que acumula los pagos.
 * @param {number} documentTotal - Importe máximo reconocible.
 * @param {Map<string, DocumentProgress>} progress - Acumulados por documento.
 * @param {ReconciledResultIncident[]} incidents - Incidencias del cálculo.
 * @returns {{amount: number, state: DocumentProgress} | null} Importe reconocido y acumulado.
 */
function capToDocument(
  movement: ReconciledResultMovement,
  documentId: string,
  documentTotal: number,
  progress: Map<string, DocumentProgress>,
  incidents: ReconciledResultIncident[],
  capAmount = movement.amount,
): { amount: number; previousRecognized: number; state: DocumentProgress } | null {
  if (!Number.isFinite(capAmount) || capAmount <= 0) {
    incidents.push({ code: 'INVALID_AMOUNT', movementId: movement.id, affectedAmount: 0 });
    return null;
  }
  if (!Number.isFinite(documentTotal) || documentTotal <= 0) {
    incidents.push({
      code: 'INVALID_DOCUMENT_TOTAL',
      movementId: movement.id,
      affectedAmount: movement.amount,
    });
    return null;
  }

  const state = progress.get(documentId) ?? {
    recognized: 0,
    historicalCost: 0,
    estimatedCost: 0,
    costInitialized: false,
  };
  const previousRecognized = state.recognized;
  const available = Math.max(0, documentTotal - state.recognized);
  const recognizedCapAmount = Math.min(capAmount, available);
  const recognizedRatio = recognizedCapAmount / capAmount;
  const amount = movement.amount * recognizedRatio;
  const excess = movement.amount - amount;
  state.recognized += recognizedCapAmount;
  progress.set(documentId, state);
  if (excess > 0) {
    incidents.push({
      code: 'PAYMENT_EXCEEDS_DOCUMENT',
      movementId: movement.id,
      affectedAmount: excess,
    });
  }
  return { amount, previousRecognized, state };
}

/**
 * @description Suma las partidas base de un mes en el acumulado anual.
 * @param {ReconciledPeriodResult} annual - Acumulado anual mutable.
 * @param {ReconciledPeriodResult} month - Mes que se incorporará.
 * @returns {void} No devuelve valor; actualiza el anual.
 */
function addMonthToAnnual(
  annual: ReconciledPeriodResult,
  month: ReconciledPeriodResult,
): void {
  annual.income.sales += month.income.sales;
  annual.income.services += month.income.services;
  annual.costOfSales.productsHistorical += month.costOfSales.productsHistorical;
  annual.costOfSales.productsEstimated += month.costOfSales.productsEstimated;
  annual.costOfSales.services += month.costOfSales.services;
  annual.operatingExpenses.salaries += month.operatingExpenses.salaries;
  annual.operatingExpenses.general += month.operatingExpenses.general;
  annual.operatingExpenses.purchasedServices += month.operatingExpenses.purchasedServices;
  annual.inventoryPurchases += month.inventoryPurchases;
  annual.nonCashAdjustments.shrinkages += month.nonCashAdjustments.shrinkages;
  annual.cashFlow.operating += month.cashFlow.operating;
  annual.cashFlow.financial += month.cashFlow.financial;
}

/**
 * @description Calcula ingresos, costos, resultado y caja desde movimientos reconciliados.
 * @param {CalculateReconciledResultInput} input - Movimientos normalizados del año solicitado.
 * @returns {ReconciledResult} Desglose mensual/anual con estimaciones e incidencias.
 */
export function calculateReconciledResult(
  input: CalculateReconciledResultInput,
): ReconciledResult {
  const monthly = Array.from({ length: 12 }, (_, index): MonthlyReconciledResult => ({
    month: index + 1,
    ...createEmptyPeriod(),
  }));
  const incidents: ReconciledResultIncident[] = [];
  const estimates: ReconciledResultEstimate[] = [];
  const revenueProgress = new Map<string, DocumentProgress>();
  const expenseProgress = new Map<string, DocumentProgress>();
  for (const opening of input.openingRecognitions ?? []) {
    if (!Number.isFinite(opening.amount) || opening.amount <= 0) continue;
    const key = opening.source === 'expense'
      ? `expense:${opening.kind}:${opening.documentId}`
      : `${opening.source}:${opening.documentId}`;
    const target = opening.source === 'expense' ? expenseProgress : revenueProgress;
    const current = target.get(key);
    target.set(key, {
      recognized: (current?.recognized ?? 0) + opening.amount,
      historicalCost: 0,
      estimatedCost: 0,
      costInitialized: false,
    });
  }
  const orderedMovements = [...input.movements].sort(
    (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
  );

  for (const movement of orderedMovements) {
    const date = new Date(movement.occurredAt);
    if (Number.isNaN(date.getTime())) {
      incidents.push({
        code: 'INVALID_DATE',
        movementId: movement.id,
        affectedAmount: Number.isFinite(movement.amount) ? movement.amount : 0,
      });
      continue;
    }
    if (!Number.isFinite(movement.amount) || movement.amount <= 0) {
      incidents.push({ code: 'INVALID_AMOUNT', movementId: movement.id, affectedAmount: 0 });
      continue;
    }
    const zoned = getZonedYearMonth(date, input.timeZone);
    if (zoned.year !== input.year) continue;
    const period = monthly[zoned.month - 1];
    const policy = classifyReconciliation({ kind: movement.kind, status: movement.status });
    if (!policy.affectsCashFlow) continue;

    if (movement.source === 'financial') {
      period.cashFlow.financial += movement.amount * policy.effectiveSign;
      continue;
    }

    if (movement.source === 'sale' || movement.source === 'service') {
      const progressKey = `${movement.source}:${movement.document.id}`;
      const capped = capToDocument(
        movement,
        progressKey,
        movement.document.revenue,
        revenueProgress,
        incidents,
      );
      if (!capped) continue;
      const recognized = capped.amount;
      period.cashFlow.operating += recognized;
      if (movement.source === 'sale') period.income.sales += recognized;
      else period.income.services += recognized;

      if (!capped.state.costInitialized) {
        const openingRatio = Math.min(
          capped.previousRecognized,
          movement.document.revenue,
        ) / movement.document.revenue;
        capped.state.historicalCost = movement.document.historicalCost * openingRatio;
        capped.state.estimatedCost = movement.document.estimatedCost * openingRatio;
        capped.state.costInitialized = true;
      }
      const ratio = capped.state.recognized / movement.document.revenue;
      const targetHistorical = movement.document.historicalCost * ratio;
      const targetEstimated = movement.document.estimatedCost * ratio;
      const historicalIncrement = targetHistorical - capped.state.historicalCost;
      const estimatedIncrement = targetEstimated - capped.state.estimatedCost;
      capped.state.historicalCost = targetHistorical;
      capped.state.estimatedCost = targetEstimated;
      if (movement.source === 'sale') {
        period.costOfSales.productsHistorical += historicalIncrement;
        period.costOfSales.productsEstimated += estimatedIncrement;
        if (estimatedIncrement > 0) {
          estimates.push({
            code: 'CURRENT_COST_FALLBACK',
            movementId: movement.id,
            affectedAmount: estimatedIncrement,
          });
        }
      } else {
        period.costOfSales.services += historicalIncrement + estimatedIncrement;
      }
      continue;
    }

    const capped = capToDocument(
      movement,
      `expense:${movement.kind}:${movement.documentId}`,
      movement.documentAmount,
      expenseProgress,
      incidents,
      movement.capAmount,
    );
    if (!capped) continue;
    const paid = capped.amount;
    period.cashFlow.operating -= paid;
    if (movement.kind === 'INVENTORY_PURCHASE') period.inventoryPurchases += paid;
    else if (movement.kind === 'SALARY_EXPENSE') period.operatingExpenses.salaries += paid;
    else if (movement.kind === 'GENERAL_EXPENSE') period.operatingExpenses.general += paid;
    else if (movement.kind === 'RECEIVED_SERVICE_EXPENSE') {
      period.operatingExpenses.purchasedServices += paid;
    }
  }

  for (const shrinkage of input.shrinkages) {
    const date = new Date(shrinkage.occurredAt);
    if (Number.isNaN(date.getTime())) {
      incidents.push({
        code: 'INVALID_DATE',
        movementId: shrinkage.id,
        affectedAmount: Number.isFinite(shrinkage.amount) ? shrinkage.amount : 0,
      });
      continue;
    }
    if (!Number.isFinite(shrinkage.amount) || shrinkage.amount <= 0) {
      incidents.push({ code: 'INVALID_AMOUNT', movementId: shrinkage.id, affectedAmount: 0 });
      continue;
    }
    const zoned = getZonedYearMonth(date, input.timeZone);
    if (zoned.year === input.year) {
      monthly[zoned.month - 1].nonCashAdjustments.shrinkages += shrinkage.amount;
    }
  }

  monthly.forEach(calculatePeriodTotals);
  const annual = createEmptyPeriod();
  monthly.forEach((month) => addMonthToAnnual(annual, month));
  calculatePeriodTotals(annual);

  return {
    year: input.year,
    timeZone: input.timeZone,
    functionalCurrency: input.functionalCurrency,
    monthly,
    annual,
    incidents,
    estimates,
  };
}
