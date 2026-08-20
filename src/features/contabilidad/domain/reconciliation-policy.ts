export const RECONCILIATION_KINDS = [
  'SALE',
  'SERVICE_SALE',
  'SALARY_EXPENSE',
  'GENERAL_EXPENSE',
  'RECEIVED_SERVICE_EXPENSE',
  'SOLD_SERVICE_COST',
  'INVENTORY_PURCHASE',
  'CASH_LOAN_DISBURSEMENT',
  'CASH_LOAN_PAYMENT',
  'CASH_DEBT_DISBURSEMENT',
  'CASH_DEBT_PAYMENT',
  'EXTERNAL_DEBT_RECEIPT',
  'BANK_TRANSFER_IN',
  'BANK_TRANSFER_OUT',
  'CAPITAL_CONTRIBUTION',
  'BANK_ADJUSTMENT_IN',
  'BANK_ADJUSTMENT_OUT',
  'SALE_REVERSAL',
  'EXPENSE_REVERSAL',
  'CAPITAL_REVERSAL',
] as const;

export const RECONCILIATION_STATUSES = [
  'POSTED',
  'PENDING',
  'PARTIAL',
  'VOIDED',
  'CANCELLED',
] as const;

export type ReconciliationKind = (typeof RECONCILIATION_KINDS)[number];
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];
export type ReconciliationCategory =
  | 'operating'
  | 'financial'
  | 'equity'
  | 'transfer'
  | 'adjustment';
export type ReconciliationDirection = 'inflow' | 'outflow';
export type ReconciliationCoverage = 'complete' | 'partial' | 'indeterminate';
export type ReconciliationRecognition = 'posted' | 'pending' | 'excluded';
export type LegacyReconciliationSource =
  | 'sale'
  | 'service'
  | 'expense'
  | 'transfer'
  | 'capital'
  | 'adjustment';

interface ReconciliationPolicyDefinition {
  category: ReconciliationCategory;
  direction: ReconciliationDirection;
  sign: 1 | -1;
  affectsOperatingResult: boolean;
}

export interface ReconciliationInput {
  kind: ReconciliationKind;
  status: ReconciliationStatus;
}

export interface ClassifiedReconciliation extends ReconciliationPolicyDefinition {
  status: 'classified';
  kind: ReconciliationKind;
  reconciliationStatus: ReconciliationStatus;
  recognition: ReconciliationRecognition;
  coverage: ReconciliationCoverage;
  effectiveSign: 1 | -1 | 0;
  affectsCashFlow: boolean;
}

export interface UnclassifiedReconciliation {
  status: 'unclassified';
  issue: 'UNKNOWN_KIND' | 'UNKNOWN_STATUS';
  rawKind: string | null;
  rawStatus: string | null;
}

export type ReconciliationClassification =
  | ClassifiedReconciliation
  | UnclassifiedReconciliation;

export interface LegacyReconciliationInput {
  source: LegacyReconciliationSource;
  kind: string | null;
  status?: string | null;
}

export const RECONCILIATION_POLICY: Record<
  ReconciliationKind,
  ReconciliationPolicyDefinition
> = {
  SALE: { category: 'operating', direction: 'inflow', sign: 1, affectsOperatingResult: true },
  SERVICE_SALE: {
    category: 'operating',
    direction: 'inflow',
    sign: 1,
    affectsOperatingResult: true,
  },
  SALARY_EXPENSE: {
    category: 'operating',
    direction: 'outflow',
    sign: -1,
    affectsOperatingResult: true,
  },
  GENERAL_EXPENSE: {
    category: 'operating',
    direction: 'outflow',
    sign: -1,
    affectsOperatingResult: true,
  },
  RECEIVED_SERVICE_EXPENSE: {
    category: 'operating',
    direction: 'outflow',
    sign: -1,
    affectsOperatingResult: true,
  },
  SOLD_SERVICE_COST: {
    category: 'operating',
    direction: 'outflow',
    sign: -1,
    affectsOperatingResult: false,
  },
  INVENTORY_PURCHASE: {
    category: 'operating',
    direction: 'outflow',
    sign: -1,
    affectsOperatingResult: false,
  },
  CASH_LOAN_DISBURSEMENT: {
    category: 'financial',
    direction: 'outflow',
    sign: -1,
    affectsOperatingResult: false,
  },
  CASH_LOAN_PAYMENT: {
    category: 'financial',
    direction: 'inflow',
    sign: 1,
    affectsOperatingResult: false,
  },
  CASH_DEBT_DISBURSEMENT: {
    category: 'financial',
    direction: 'inflow',
    sign: 1,
    affectsOperatingResult: false,
  },
  CASH_DEBT_PAYMENT: {
    category: 'financial',
    direction: 'outflow',
    sign: -1,
    affectsOperatingResult: false,
  },
  EXTERNAL_DEBT_RECEIPT: {
    category: 'financial',
    direction: 'inflow',
    sign: 1,
    affectsOperatingResult: false,
  },
  BANK_TRANSFER_IN: {
    category: 'transfer',
    direction: 'inflow',
    sign: 1,
    affectsOperatingResult: false,
  },
  BANK_TRANSFER_OUT: {
    category: 'transfer',
    direction: 'outflow',
    sign: -1,
    affectsOperatingResult: false,
  },
  CAPITAL_CONTRIBUTION: {
    category: 'equity',
    direction: 'inflow',
    sign: 1,
    affectsOperatingResult: false,
  },
  BANK_ADJUSTMENT_IN: {
    category: 'adjustment',
    direction: 'inflow',
    sign: 1,
    affectsOperatingResult: false,
  },
  BANK_ADJUSTMENT_OUT: {
    category: 'adjustment',
    direction: 'outflow',
    sign: -1,
    affectsOperatingResult: false,
  },
  SALE_REVERSAL: {
    category: 'operating',
    direction: 'outflow',
    sign: -1,
    affectsOperatingResult: true,
  },
  EXPENSE_REVERSAL: {
    category: 'operating',
    direction: 'inflow',
    sign: 1,
    affectsOperatingResult: true,
  },
  CAPITAL_REVERSAL: {
    category: 'equity',
    direction: 'outflow',
    sign: -1,
    affectsOperatingResult: false,
  },
};

const LEGACY_KIND_MAP: Record<LegacyReconciliationSource, Record<string, ReconciliationKind>> = {
  sale: {
    VENTA: 'SALE',
    PRESTAMO_CASH_DESEMBOLSO: 'CASH_LOAN_DISBURSEMENT',
    PRESTAMO_CASH: 'CASH_LOAN_PAYMENT',
    DEUDA_CASH_DESEMBOLSO: 'CASH_DEBT_DISBURSEMENT',
    DEUDA_CASH: 'CASH_DEBT_PAYMENT',
  },
  service: { SERVICIO: 'SERVICE_SALE' },
  expense: {
    SALARIO: 'SALARY_EXPENSE',
    GASTODE: 'GENERAL_EXPENSE',
    COMPRA: 'INVENTORY_PURCHASE',
    SERVICIO: 'RECEIVED_SERVICE_EXPENSE',
    VENTA_SERVICIO: 'SOLD_SERVICE_COST',
  },
  transfer: {
    ENTRADA: 'BANK_TRANSFER_IN',
    TRANSFERENCIA_ENTRADA: 'BANK_TRANSFER_IN',
    SALIDA: 'BANK_TRANSFER_OUT',
    TRANSFERENCIA_SALIDA: 'BANK_TRANSFER_OUT',
  },
  capital: {
    CAPITAL_SOCIAL: 'CAPITAL_CONTRIBUTION',
    DEUDA_EXTERNA: 'EXTERNAL_DEBT_RECEIPT',
  },
  adjustment: {
    INGRESO: 'BANK_ADJUSTMENT_IN',
    AJUSTE_INGRESO: 'BANK_ADJUSTMENT_IN',
    EGRESO: 'BANK_ADJUSTMENT_OUT',
    AJUSTE_EGRESO: 'BANK_ADJUSTMENT_OUT',
  },
};

const LEGACY_STATUS_MAP: Record<string, ReconciliationStatus> = {
  POSTED: 'POSTED',
  PAGADA: 'POSTED',
  PAGADO: 'POSTED',
  PENDING: 'PENDING',
  PENDIENTE: 'PENDING',
  PARTIAL: 'PARTIAL',
  PARCIAL: 'PARTIAL',
  VOIDED: 'VOIDED',
  ANULADA: 'VOIDED',
  ANULADO: 'VOIDED',
  CANCELLED: 'CANCELLED',
  CANCELADA: 'CANCELLED',
  CANCELADO: 'CANCELLED',
};

/**
 * @description Clasifica una reconciliación ya normalizada y calcula su impacto efectivo.
 * @param {ReconciliationInput} input - Tipo y estado canónicos de la reconciliación.
 * @returns {ClassifiedReconciliation} Política financiera lista para agregación.
 */
export function classifyReconciliation(input: ReconciliationInput): ClassifiedReconciliation {
  const definition = RECONCILIATION_POLICY[input.kind];
  const recognition: ReconciliationRecognition =
    input.status === 'PENDING'
      ? 'pending'
      : input.status === 'VOIDED' || input.status === 'CANCELLED'
        ? 'excluded'
        : 'posted';
  const coverage: ReconciliationCoverage =
    input.status === 'PARTIAL'
      ? 'partial'
      : input.status === 'PENDING'
        ? 'indeterminate'
        : 'complete';
  const isPosted = recognition === 'posted';

  return {
    status: 'classified',
    kind: input.kind,
    reconciliationStatus: input.status,
    ...definition,
    recognition,
    coverage,
    effectiveSign: isPosted ? definition.sign : 0,
    affectsCashFlow: isPosted,
    affectsOperatingResult: isPosted && definition.affectsOperatingResult,
  };
}

/**
 * @description Convierte strings legacy en tipos canónicos o devuelve una incidencia explícita.
 * @param {LegacyReconciliationInput} input - Fuente, tipo y estado persistidos por código legacy.
 * @returns {ReconciliationClassification} Clasificación segura o causa de rechazo.
 */
export function classifyLegacyReconciliation(
  input: LegacyReconciliationInput,
): ReconciliationClassification {
  const rawKind = input.kind?.trim() || null;
  const normalizedKind = rawKind?.toUpperCase() ||
    (input.source === 'sale' ? 'VENTA' : input.source === 'service' ? 'SERVICIO' : '');
  const kind = LEGACY_KIND_MAP[input.source][normalizedKind];
  if (!kind) {
    return {
      status: 'unclassified',
      issue: 'UNKNOWN_KIND',
      rawKind,
      rawStatus: input.status?.trim() || null,
    };
  }

  const rawStatus = input.status?.trim() || null;
  const status = rawStatus ? LEGACY_STATUS_MAP[rawStatus.toUpperCase()] : 'POSTED';
  if (!status) {
    return { status: 'unclassified', issue: 'UNKNOWN_STATUS', rawKind, rawStatus };
  }

  return classifyReconciliation({ kind, status });
}
