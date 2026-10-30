const MONEY_TOLERANCE = 0.01;

interface OpenDebtEvidence {
  tenantId: string;
  state: string;
  amount: unknown;
  paidAmount: unknown;
  linkedDirectly: boolean;
  reconciledAmount?: unknown;
}

interface OpenDebtCloseCandidate {
  operationTenantId: string;
  operationAmount: unknown;
  debt: OpenDebtEvidence | null;
}

/**
 * @description Confirms a transaction is fully represented by a directly linked, unpaid debt.
 * @param {OpenDebtCloseCandidate} candidate - Transaction and related debt evidence.
 * @returns {boolean} Whether the outstanding debt safely explains the unreconciled transaction.
 */
export function isPermittedOpenDebtForClose(
  candidate: OpenDebtCloseCandidate,
): boolean {
  const { debt } = candidate;
  const operationAmount = Number(candidate.operationAmount);
  if (!debt || !debt.linkedDirectly || debt.tenantId !== candidate.operationTenantId) {
    return false;
  }

  const debtAmount = Number(debt.amount);
  const paidAmount = Number(debt.paidAmount);
  const reconciledAmount = Number(debt.reconciledAmount ?? 0);
  const unpaidOpenDebt = debt.state === 'PENDIENTE' &&
    Math.abs(paidAmount) <= MONEY_TOLERANCE &&
    Math.abs(reconciledAmount) <= MONEY_TOLERANCE;
  const partiallyPaidOpenDebt = debt.state === 'PARCIAL' &&
    paidAmount > MONEY_TOLERANCE &&
    paidAmount < debtAmount - MONEY_TOLERANCE &&
    reconciledAmount > MONEY_TOLERANCE &&
    Math.abs(paidAmount - reconciledAmount) <= MONEY_TOLERANCE;
  return (
    Number.isFinite(operationAmount) &&
    operationAmount > 0 &&
    Number.isFinite(debtAmount) &&
    debtAmount > 0 &&
    Math.abs(debtAmount - operationAmount) <= MONEY_TOLERANCE &&
    Number.isFinite(paidAmount) &&
    Number.isFinite(reconciledAmount) &&
    (unpaidOpenDebt || partiallyPaidOpenDebt)
  );
}

/**
 * @description Confirms verified reconciliation amounts cover the complete operation amount.
 * @param {unknown} operationAmount - Source operation amount in its established currency.
 * @param {unknown[]} reconciledAmounts - Applied reconciliation amounts in that same currency.
 * @returns {boolean} Whether valid positive reconciliation amounts fully cover the operation.
 */
export function isReconciledAmountComplete(
  operationAmount: unknown,
  reconciledAmounts: unknown[],
): boolean {
  const total = Number(operationAmount);
  if (!Number.isFinite(total) || total <= 0 || reconciledAmounts.length === 0) return false;

  let reconciled = 0;
  for (const value of reconciledAmounts) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return false;
    reconciled += amount;
  }

  return Math.abs(reconciled - total) <= MONEY_TOLERANCE;
}
