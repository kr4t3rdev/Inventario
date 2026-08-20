export type AccountingAmountIssue =
  | 'INVALID_AMOUNT'
  | 'INVALID_CURRENCY'
  | 'MISSING_CONVERSION'
  | 'INVALID_CONVERTED_AMOUNT'
  | 'INVALID_RATE'
  | 'MISSING_RATE_DATE'
  | 'INVALID_RATE_DATE'
  | 'INVALID_OPERATION_DATE'
  | 'FUTURE_RATE'
  | 'INCONSISTENT_CONVERSION';

export interface NormalizeAccountingAmountInput {
  amount: number;
  currency: string;
  functionalCurrency: string;
  convertedAmount?: number | null;
  exchangeRate?: number | null;
  operationAt: Date | string;
  rateEffectiveAt?: Date | string | null;
}

interface AccountingAmountBase {
  status: 'normalized';
  amount: number;
  currency: string;
  exchangeRate: number;
}

export interface SameCurrencyAccountingAmount extends AccountingAmountBase {
  source: 'same_currency';
}

export interface ConvertedAccountingAmount extends AccountingAmountBase {
  source: 'persisted_conversion';
  rateEffectiveAt: string;
}

export type NormalizedAccountingAmount =
  | SameCurrencyAccountingAmount
  | ConvertedAccountingAmount;

export interface UnresolvedAccountingAmount {
  status: 'unresolved';
  amount: null;
  currency: string;
  issue: AccountingAmountIssue;
}

export type AccountingAmountResult =
  | NormalizedAccountingAmount
  | UnresolvedAccountingAmount;

export interface AccountingAmountCoverage {
  total: number;
  normalized: number;
  unresolved: number;
  percentage: number;
  unresolvedByIssue: Partial<Record<AccountingAmountIssue, number>>;
}

export interface AccountingAmountBackfillRecord extends NormalizeAccountingAmountInput {
  id: string;
}

export interface AccountingAmountBackfillPlan {
  dryRun: true;
  updates: Array<{
    id: string;
    convertedAmount: number;
    exchangeRate: number;
    rateEffectiveAt: string;
  }>;
  unresolved: Array<{ id: string; issue: AccountingAmountIssue }>;
}

/**
 * @description Normaliza un importe persistido a la moneda funcional sin inventar conversiones.
 * @param {NormalizeAccountingAmountInput} input - Importe, monedas y procedencia de la tasa.
 * @returns {AccountingAmountResult} Importe normalizado o incidencia explícita de cobertura.
 */
export function normalizeAccountingAmount(
  input: NormalizeAccountingAmountInput,
): AccountingAmountResult {
  const currency = input.currency.trim().toUpperCase();
  const functionalCurrency = input.functionalCurrency.trim().toUpperCase();

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return {
      status: 'unresolved',
      amount: null,
      currency: functionalCurrency,
      issue: 'INVALID_AMOUNT',
    };
  }

  if (!currency || !functionalCurrency) {
    return {
      status: 'unresolved',
      amount: null,
      currency: functionalCurrency,
      issue: 'INVALID_CURRENCY',
    };
  }

  if (currency === functionalCurrency) {
    return {
      status: 'normalized',
      amount: input.amount,
      currency: functionalCurrency,
      exchangeRate: 1,
      source: 'same_currency',
    };
  }

  if (input.convertedAmount == null) {
    return {
      status: 'unresolved',
      amount: null,
      currency: functionalCurrency,
      issue: 'MISSING_CONVERSION',
    };
  }

  if (!Number.isFinite(input.convertedAmount) || input.convertedAmount <= 0) {
    return {
      status: 'unresolved',
      amount: null,
      currency: functionalCurrency,
      issue: 'INVALID_CONVERTED_AMOUNT',
    };
  }

  if (!Number.isFinite(input.exchangeRate) || Number(input.exchangeRate) <= 0) {
    return {
      status: 'unresolved',
      amount: null,
      currency: functionalCurrency,
      issue: 'INVALID_RATE',
    };
  }

  if (input.rateEffectiveAt == null) {
    return {
      status: 'unresolved',
      amount: null,
      currency: functionalCurrency,
      issue: 'MISSING_RATE_DATE',
    };
  }

  const operationAt = new Date(input.operationAt);
  const rateEffectiveAt = new Date(input.rateEffectiveAt);

  if (Number.isNaN(operationAt.getTime())) {
    return {
      status: 'unresolved',
      amount: null,
      currency: functionalCurrency,
      issue: 'INVALID_OPERATION_DATE',
    };
  }

  if (Number.isNaN(rateEffectiveAt.getTime())) {
    return {
      status: 'unresolved',
      amount: null,
      currency: functionalCurrency,
      issue: 'INVALID_RATE_DATE',
    };
  }

  if (rateEffectiveAt.getTime() > operationAt.getTime()) {
    return {
      status: 'unresolved',
      amount: null,
      currency: functionalCurrency,
      issue: 'FUTURE_RATE',
    };
  }

  const expectedAmount = input.amount * Number(input.exchangeRate);
  const tolerance = Math.max(0.01, Math.abs(expectedAmount) * 0.000001);
  if (Math.abs(input.convertedAmount - expectedAmount) > tolerance) {
    return {
      status: 'unresolved',
      amount: null,
      currency: functionalCurrency,
      issue: 'INCONSISTENT_CONVERSION',
    };
  }

  return {
    status: 'normalized',
    amount: input.convertedAmount,
    currency: functionalCurrency,
    exchangeRate: Number(input.exchangeRate),
    rateEffectiveAt: rateEffectiveAt.toISOString(),
    source: 'persisted_conversion',
  };
}

/**
 * @description Resume qué proporción de importes puede expresarse en la moneda funcional.
 * @param {AccountingAmountResult[]} results - Resultados de normalización individuales.
 * @returns {AccountingAmountCoverage} Cobertura y conteo de incidencias por causa.
 */
export function summarizeAccountingAmountCoverage(
  results: AccountingAmountResult[],
): AccountingAmountCoverage {
  const unresolvedByIssue: Partial<Record<AccountingAmountIssue, number>> = {};
  let normalized = 0;

  for (const result of results) {
    if (result.status === 'normalized') {
      normalized += 1;
      continue;
    }
    unresolvedByIssue[result.issue] = (unresolvedByIssue[result.issue] ?? 0) + 1;
  }

  const total = results.length;
  const unresolved = total - normalized;
  return {
    total,
    normalized,
    unresolved,
    percentage: total === 0 ? 100 : Number(((normalized / total) * 100).toFixed(2)),
    unresolvedByIssue,
  };
}

/**
 * @description Construye un plan dry-run para completar conversiones históricas deterministas.
 * @param {AccountingAmountBackfillRecord[]} records - Registros históricos con su tasa disponible.
 * @returns {AccountingAmountBackfillPlan} Actualizaciones seguras e incidencias que requieren revisión.
 */
export function buildAccountingAmountBackfillPlan(
  records: AccountingAmountBackfillRecord[],
): AccountingAmountBackfillPlan {
  const updates: AccountingAmountBackfillPlan['updates'] = [];
  const unresolved: AccountingAmountBackfillPlan['unresolved'] = [];

  for (const record of records) {
    const currency = record.currency.trim().toUpperCase();
    const functionalCurrency = record.functionalCurrency.trim().toUpperCase();
    const canCalculateConversion =
      currency !== functionalCurrency &&
      record.convertedAmount == null &&
      typeof record.exchangeRate === 'number' &&
      Number.isFinite(record.exchangeRate) &&
      record.exchangeRate > 0 &&
      record.rateEffectiveAt != null;
    const convertedAmount = canCalculateConversion
      ? record.amount * Number(record.exchangeRate)
      : record.convertedAmount;
    const result = normalizeAccountingAmount({ ...record, convertedAmount });

    if (result.status === 'unresolved') {
      unresolved.push({ id: record.id, issue: result.issue });
      continue;
    }

    if (result.source === 'persisted_conversion' && record.convertedAmount == null) {
      updates.push({
        id: record.id,
        convertedAmount: result.amount,
        exchangeRate: result.exchangeRate,
        rateEffectiveAt: result.rateEffectiveAt,
      });
    }
  }

  return { dryRun: true, updates, unresolved };
}
