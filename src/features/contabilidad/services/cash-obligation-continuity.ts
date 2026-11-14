import { Prisma } from '@/generated/prisma';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import { calculateCashObligationPaymentAllocation } from '@/features/contabilidad-formal/lib/cash-obligation-payment-allocation';
import { cashPaymentAllocationFingerprint } from '@/features/contabilidad-formal/lib/cash-payment-allocation-fingerprint';

export interface FunctionalBalanceInput {
  originalAmount: string;
  paidAmount: string;
  pendingAmount?: string;
  debtFunctionalAmount: string | null;
  paidFunctionalAmount: string | null;
  originalCurrency: string;
  recordFunctionalCurrency: string | null;
  functionalCurrency: string;
  fxEvidence: Record<string, unknown> | null;
  fxEvidenceFingerprint: string | null;
  fxEvidenceVersion: number | null;
}

/**
 * @description Resuelve el saldo funcional únicamente con FX guardado e íntegro.
 * @param {FunctionalBalanceInput} input - Saldo operativo y metadatos de valuación.
 * @returns {string | null | undefined} Valor funcional, nulo si no es verificable.
 */
export function resolveFunctionalBalance(input: FunctionalBalanceInput): string | null | undefined {
  const originalCurrency = input.originalCurrency.trim().toUpperCase();
  const functionalCurrency = input.functionalCurrency.trim().toUpperCase();
  if (input.pendingAmount !== undefined) {
    try {
      const original = new Prisma.Decimal(input.originalAmount);
      const paid = new Prisma.Decimal(input.paidAmount);
      const pending = new Prisma.Decimal(input.pendingAmount);
      if (!original.isFinite() || !paid.isFinite() || !pending.isFinite() ||
        !pending.eq(original.minus(paid))) return null;
    } catch {
      return null;
    }
  }
  if (originalCurrency === functionalCurrency) {
    return input.recordFunctionalCurrency &&
      input.recordFunctionalCurrency.trim().toUpperCase() !== functionalCurrency
      ? null
      : undefined;
  }
  if (
    input.recordFunctionalCurrency?.trim().toUpperCase() !== functionalCurrency ||
    input.debtFunctionalAmount === null || input.paidFunctionalAmount === null ||
    !input.fxEvidenceFingerprint?.trim() || input.fxEvidenceVersion !== 1 || !input.fxEvidence
  ) return null;

  const fx = input.fxEvidence;
  const fxOriginalCurrency = typeof fx.originalCurrency === 'string'
    ? fx.originalCurrency.trim().toUpperCase()
    : '';
  const fxFunctionalCurrency = typeof fx.functionalCurrency === 'string'
    ? fx.functionalCurrency.trim().toUpperCase()
    : '';
  const fxFingerprint = typeof fx.fxEvidenceFingerprint === 'string'
    ? fx.fxEvidenceFingerprint
    : '';
  const source = typeof fx.fxProvenanceSource === 'string' ? fx.fxProvenanceSource : '';
  const rateEffectiveAt = typeof fx.rateEffectiveAt === 'string' ? new Date(fx.rateEffectiveAt) : null;
  const exchangeRate = typeof fx.exchangeRate === 'string' || typeof fx.exchangeRate === 'number'
    ? Number(fx.exchangeRate)
    : Number.NaN;
  const sourceAmount = typeof fx.originalAmount === 'string' || typeof fx.originalAmount === 'number'
    ? Number(fx.originalAmount)
    : Number.NaN;
  const convertedAmount = typeof fx.functionalAmount === 'string' || typeof fx.functionalAmount === 'number'
    ? Number(fx.functionalAmount)
    : Number.NaN;
  const fxCatalogRateId = typeof fx.fxCatalogRateId === 'string' ? fx.fxCatalogRateId : null;
  if (
    fxOriginalCurrency !== originalCurrency || fxFunctionalCurrency !== functionalCurrency ||
    fxFingerprint !== input.fxEvidenceFingerprint || !source || !rateEffectiveAt ||
    !Number.isFinite(rateEffectiveAt.getTime()) || !Number.isFinite(exchangeRate) ||
    !Number.isFinite(sourceAmount) || !Number.isFinite(convertedAmount)
  ) return null;

  try {
    const verified = buildAppliedFxEvidence({
      originalAmount: sourceAmount,
      originalCurrency,
      functionalCurrency,
      exchangeRate,
      convertedAmount,
      rateEffectiveAt,
      source,
      fxCatalogRateId,
    });
    const original = new Prisma.Decimal(input.originalAmount);
    const paid = new Prisma.Decimal(input.paidAmount);
    const debtFunctional = new Prisma.Decimal(input.debtFunctionalAmount);
    const paidFunctional = new Prisma.Decimal(input.paidFunctionalAmount);
    if (
      verified.fxEvidenceFingerprint !== input.fxEvidenceFingerprint ||
      !new Prisma.Decimal(sourceAmount).eq(original) ||
      !new Prisma.Decimal(convertedAmount).eq(debtFunctional) ||
      !original.isFinite() || original.isNegative() || !paid.isFinite() || paid.isNegative() ||
      paid.greaterThan(original) || !debtFunctional.isFinite() || debtFunctional.isNegative() ||
      !paidFunctional.isFinite() || paidFunctional.isNegative() ||
      paidFunctional.greaterThan(debtFunctional) ||
      (input.pendingAmount !== undefined &&
        !new Prisma.Decimal(input.pendingAmount).eq(original.minus(paid)))
    ) return null;
    return debtFunctional.minus(paidFunctional).toString();
  } catch {
    return null;
  }
}

type CashDecimal = Prisma.Decimal | string | number;

interface CashPaymentAllocationRecord {
  reconciliacionId: string;
  obligationType: string;
  policyVersion: number;
  grantDate: Date;
  maturityDate: Date | null;
  paymentDate: Date;
  accrualCheckpointDate: Date;
  ordinaryElapsedDays: number;
  moratoryElapsedDays: number;
  ordinaryAnnualRate: CashDecimal;
  moratoryAnnualRate: CashDecimal;
  principalBefore: CashDecimal;
  overduePrincipalBefore: CashDecimal;
  ordinaryCarryBefore: CashDecimal;
  moratoryCarryBefore: CashDecimal;
  ordinaryAccruedThisPeriod: CashDecimal;
  moratoryAccruedThisPeriod: CashDecimal;
  paymentAmount: CashDecimal;
  moratoryAllocated: CashDecimal;
  ordinaryAllocated: CashDecimal;
  principalAllocated: CashDecimal;
  principalAfter: CashDecimal;
  ordinaryCarryAfter: CashDecimal;
  moratoryCarryAfter: CashDecimal;
  functionalAmount: CashDecimal;
  moratoryFunctional: CashDecimal;
  ordinaryFunctional: CashDecimal;
  principalFunctional: CashDecimal;
  functionalCurrency: string;
  fxEvidenceFingerprint: string | null;
  eventFingerprint: string;
}

interface CashPaymentRecord {
  reconciliacionId: string;
  monto: CashDecimal;
  montoConvertido: CashDecimal | null;
  moneda: string;
  functionalCurrency: string | null;
  tasaCambio: CashDecimal | null;
  rateEffectiveAt: Date | null;
  fxProvenanceSource: string | null;
  fxCatalogRateId: string | null;
  fxEvidenceJson: unknown;
  fxEvidenceFingerprint: string | null;
  fxEvidenceVersion: number | null;
  fechaReconciliacion: Date;
  cashInterestAllocation: CashPaymentAllocationRecord | null;
}

interface CashInterestSnapshot {
  cashInterestPolicyVersion: number | null;
  cashInterestGrantDate: Date | null;
  cashInterestMaturityDate: Date | null;
  ordinaryAnnualRate: CashDecimal | null;
  moratoryAnnualRate: CashDecimal | null;
  cashInterestAccruedThroughDate: Date | null;
  cashInterestPrincipalRemaining: CashDecimal | null;
  cashInterestOrdinaryCarry: CashDecimal | null;
  cashInterestMoratoryCarry: CashDecimal | null;
}

/**
 * @description Reconstruye la deuda cash desde su principal, devengos y pagos con evidencia.
 * @param {object} input - Saldos actuales, FX inicial, snapshot y pagos de la obligación.
 * @returns {string | null} Saldo funcional verificable o nulo cuando falta evidencia.
 */
export function resolveCashObligationFunctionalBalance(input: {
  principalAmount: CashDecimal;
  originalCurrency: string;
  recordFunctionalCurrency: string | null;
  functionalCurrency: string;
  debtAmount: CashDecimal;
  paidAmount: CashDecimal;
  pendingAmount?: CashDecimal;
  debtFunctionalAmount: CashDecimal | null;
  paidFunctionalAmount: CashDecimal | null;
  fxEvidence: unknown;
  fxEvidenceFingerprint: string | null;
  fxEvidenceVersion: number | null;
  interest: CashInterestSnapshot;
  payments: CashPaymentRecord[];
  obligationType: 'loan' | 'debt';
}): string | null {
  try {
    const principal = new Prisma.Decimal(input.principalAmount);
    const originalCurrency = input.originalCurrency.trim().toUpperCase();
    const functionalCurrency = input.functionalCurrency.trim().toUpperCase();
    const interest = input.interest;
    if (
      !principal.isFinite() || principal.lte(0) || interest.cashInterestPolicyVersion !== 1 ||
      !interest.cashInterestGrantDate || interest.ordinaryAnnualRate === null ||
      interest.moratoryAnnualRate === null || !interest.cashInterestAccruedThroughDate ||
      interest.cashInterestPrincipalRemaining === null || interest.cashInterestOrdinaryCarry === null ||
      interest.cashInterestMoratoryCarry === null || input.debtFunctionalAmount === null ||
      input.paidFunctionalAmount === null ||
      input.recordFunctionalCurrency?.trim().toUpperCase() !== functionalCurrency
    ) return null;

    const initialFx = asEvidenceRecord(input.fxEvidence);
    let initialFunctional = principal;
    if (originalCurrency !== functionalCurrency) {
      const amount = initialFx?.functionalAmount;
      if (typeof amount !== 'string' && typeof amount !== 'number') return null;
      initialFunctional = new Prisma.Decimal(amount);
      const verifiedInitial = resolveFunctionalBalance({
        originalAmount: principal.toString(),
        paidAmount: '0',
        debtFunctionalAmount: initialFunctional.toString(),
        paidFunctionalAmount: '0',
        originalCurrency,
        recordFunctionalCurrency: input.recordFunctionalCurrency,
        functionalCurrency,
        fxEvidence: initialFx,
        fxEvidenceFingerprint: input.fxEvidenceFingerprint,
        fxEvidenceVersion: input.fxEvidenceVersion,
      });
      if (verifiedInitial === null) return null;
    } else if (!input.recordFunctionalCurrency) {
      return null;
    }

    let totalDebt = principal;
    let totalDebtFunctional = initialFunctional;
    let totalPaid = new Prisma.Decimal(0);
    let totalPaidFunctional = new Prisma.Decimal(0);
    let accrualState = {
      policyVersion: 1,
      grantDate: interest.cashInterestGrantDate,
      maturityDate: interest.cashInterestMaturityDate,
      accruedThroughDate: interest.cashInterestGrantDate,
      principalRemaining: principal,
      ordinaryAnnualRate: new Prisma.Decimal(interest.ordinaryAnnualRate),
      moratoryAnnualRate: new Prisma.Decimal(interest.moratoryAnnualRate),
      ordinaryCarry: new Prisma.Decimal(0),
      moratoryCarry: new Prisma.Decimal(0),
    };

    const remainingPayments = [...input.payments];
    while (remainingPayments.length > 0) {
      const matchingIndexes = remainingPayments.flatMap((payment, index) =>
        matchesAllocationStart(payment, accrualState, interest, input.obligationType) ? [index] : [],
      );
      if (matchingIndexes.length !== 1) return null;
      const payment = remainingPayments.splice(matchingIndexes[0], 1)[0];
      const allocation = payment.cashInterestAllocation;
      if (!allocation || allocation.reconciliacionId !== payment.reconciliacionId) return null;
      const rate = payment.tasaCambio === null
        ? originalCurrency === functionalCurrency ? new Prisma.Decimal(1) : null
        : new Prisma.Decimal(payment.tasaCambio);
      const functionalAmount = payment.montoConvertido === null
        ? null
        : new Prisma.Decimal(payment.montoConvertido);
      if (
        !rate || !rate.isFinite() || rate.lte(0) || !functionalAmount ||
        !functionalAmount.isFinite() || payment.functionalCurrency?.trim().toUpperCase() !== functionalCurrency ||
        payment.moneda.trim().toUpperCase() !== originalCurrency ||
        payment.fxEvidenceVersion !== 1 || !payment.fxEvidenceFingerprint || !payment.fxProvenanceSource
      ) return null;

      const paymentFx = asEvidenceRecord(payment.fxEvidenceJson);
      const embeddedSource = paymentFx?.fxProvenanceSource;
      const embeddedRateEffectiveAt = paymentFx?.rateEffectiveAt;
      if (
        typeof embeddedSource !== 'string' || embeddedSource !== payment.fxProvenanceSource ||
        paymentFx?.fxEvidenceFingerprint !== payment.fxEvidenceFingerprint ||
        paymentFx?.fxCatalogRateId !== payment.fxCatalogRateId ||
        paymentFx?.fxEvidenceVersion !== payment.fxEvidenceVersion ||
        typeof embeddedRateEffectiveAt !== 'string' || !payment.rateEffectiveAt ||
        new Date(embeddedRateEffectiveAt).getTime() !== payment.rateEffectiveAt.getTime()
      ) return null;
      const verifiedPaymentFx = buildAppliedFxEvidence({
        originalAmount: new Prisma.Decimal(payment.monto).toNumber(),
        originalCurrency,
        functionalCurrency,
        exchangeRate: rate.toNumber(),
        convertedAmount: functionalAmount.toNumber(),
        rateEffectiveAt: payment.rateEffectiveAt ?? payment.fechaReconciliacion,
        source: payment.fxProvenanceSource,
        fxCatalogRateId: payment.fxCatalogRateId,
      });
      if (
        verifiedPaymentFx.fxEvidenceFingerprint !== payment.fxEvidenceFingerprint ||
        !decimalEquals(paymentFx.originalAmount, payment.monto) ||
        !decimalEquals(paymentFx.functionalAmount, functionalAmount) ||
        !decimalEquals(paymentFx.exchangeRate, rate) ||
        paymentFx.originalCurrency !== originalCurrency || paymentFx.functionalCurrency !== functionalCurrency
      ) return null;

      const expected = calculateCashObligationPaymentAllocation({
        obligation: accrualState,
        paymentAmount: payment.monto,
        paymentDate: payment.fechaReconciliacion,
      });
      const ordinaryDelta = roundedAccruedDelta(
        expected.ordinaryCarryBefore,
        expected.ordinaryAccruedThisPeriod,
      );
      const moratoryDelta = roundedAccruedDelta(
        expected.moratoryCarryBefore,
        expected.moratoryAccruedThisPeriod,
      );
      const interestDelta = ordinaryDelta.plus(moratoryDelta);
      const interestFunctional = interestDelta.mul(rate)
        .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      const ordinaryFunctional = expected.allocation.allocated.ordinaryInterest.mul(rate)
        .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      const moratoryFunctional = expected.allocation.allocated.moratoryInterest.mul(rate)
        .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);

      if (
        !dateEquals(allocation.grantDate, expected.grantDate) ||
        !dateEquals(allocation.maturityDate, expected.maturityDate) ||
        !dateEquals(allocation.paymentDate, expected.paymentDate) ||
        !dateEquals(allocation.accrualCheckpointDate, expected.accruedThroughDate) ||
        allocation.obligationType !== input.obligationType ||
        allocation.policyVersion !== 1 ||
        allocation.ordinaryElapsedDays !== expected.ordinaryElapsedDays ||
        allocation.moratoryElapsedDays !== expected.moratoryElapsedDays ||
        !decimalEquals(allocation.ordinaryAnnualRate, persistedDecimal(expected.ordinaryAnnualRate, 10)) ||
        !decimalEquals(allocation.moratoryAnnualRate, persistedDecimal(expected.moratoryAnnualRate, 10)) ||
        !decimalEquals(allocation.principalBefore, persistedDecimal(expected.principalBefore, 4)) ||
        !decimalEquals(allocation.overduePrincipalBefore, persistedDecimal(expected.overduePrincipalBefore, 4)) ||
        !decimalEquals(allocation.ordinaryCarryBefore, persistedDecimal(expected.ordinaryCarryBefore, 18)) ||
        !decimalEquals(allocation.moratoryCarryBefore, persistedDecimal(expected.moratoryCarryBefore, 18)) ||
        !decimalEquals(allocation.ordinaryAccruedThisPeriod, persistedDecimal(expected.ordinaryAccruedThisPeriod, 18)) ||
        !decimalEquals(allocation.moratoryAccruedThisPeriod, persistedDecimal(expected.moratoryAccruedThisPeriod, 18)) ||
        !decimalEquals(allocation.paymentAmount, payment.monto) ||
        !decimalEquals(allocation.moratoryAllocated, expected.allocation.allocated.moratoryInterest) ||
        !decimalEquals(allocation.ordinaryAllocated, expected.allocation.allocated.ordinaryInterest) ||
        !decimalEquals(allocation.principalAllocated, expected.allocation.allocated.principal) ||
        !decimalEquals(allocation.principalAfter, persistedDecimal(expected.principalAfter, 4)) ||
        !decimalEquals(allocation.ordinaryCarryAfter, persistedDecimal(expected.ordinaryCarryAfter, 18)) ||
        !decimalEquals(allocation.moratoryCarryAfter, persistedDecimal(expected.moratoryCarryAfter, 18)) ||
        !decimalEquals(allocation.functionalAmount, functionalAmount) ||
        !decimalEquals(allocation.moratoryFunctional, moratoryFunctional) ||
        !decimalEquals(allocation.ordinaryFunctional, ordinaryFunctional) ||
        !decimalEquals(allocation.principalFunctional, functionalAmount.minus(ordinaryFunctional).minus(moratoryFunctional)) ||
        allocation.functionalCurrency.trim().toUpperCase() !== functionalCurrency ||
        allocation.fxEvidenceFingerprint !== payment.fxEvidenceFingerprint ||
        cashPaymentAllocationFingerprint({
          reconciliacionId: allocation.reconciliacionId,
          obligationType: allocation.obligationType,
          policyVersion: allocation.policyVersion,
          paymentDate: allocation.paymentDate,
          principalBefore: new Prisma.Decimal(allocation.principalBefore),
          ordinaryAnnualRate: new Prisma.Decimal(allocation.ordinaryAnnualRate),
          moratoryAnnualRate: new Prisma.Decimal(allocation.moratoryAnnualRate),
          ordinaryCarryBefore: new Prisma.Decimal(allocation.ordinaryCarryBefore),
          moratoryCarryBefore: new Prisma.Decimal(allocation.moratoryCarryBefore),
          paymentAmount: new Prisma.Decimal(allocation.paymentAmount),
          functionalAmount: new Prisma.Decimal(allocation.functionalAmount),
          fxEvidenceFingerprint: allocation.fxEvidenceFingerprint,
          ordinaryAllocated: new Prisma.Decimal(allocation.ordinaryAllocated),
          moratoryAllocated: new Prisma.Decimal(allocation.moratoryAllocated),
          principalAllocated: new Prisma.Decimal(allocation.principalAllocated),
        }) !== allocation.eventFingerprint
      ) return null;

      totalDebt = totalDebt.plus(interestDelta).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      totalDebtFunctional = totalDebtFunctional.plus(interestFunctional).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      totalPaid = totalPaid.plus(payment.monto).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      totalPaidFunctional = totalPaidFunctional.plus(functionalAmount).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      accrualState = {
        ...accrualState,
        accruedThroughDate: expected.accruedThroughDate,
        principalRemaining: persistedDecimal(expected.principalAfter, 4),
        ordinaryCarry: persistedDecimal(expected.ordinaryCarryAfter, 18),
        moratoryCarry: persistedDecimal(expected.moratoryCarryAfter, 18),
      };
    }

    if (
      !decimalEquals(totalDebt, input.debtAmount) ||
      !decimalEquals(totalPaid, input.paidAmount) ||
      (input.pendingAmount !== undefined &&
        !decimalEquals(input.pendingAmount, totalDebt.minus(totalPaid))) ||
      !decimalEquals(totalDebtFunctional, input.debtFunctionalAmount) ||
      !decimalEquals(totalPaidFunctional, input.paidFunctionalAmount) ||
      !dateEquals(accrualState.accruedThroughDate, interest.cashInterestAccruedThroughDate) ||
      !decimalEquals(accrualState.principalRemaining, interest.cashInterestPrincipalRemaining) ||
      !decimalEquals(accrualState.ordinaryCarry, interest.cashInterestOrdinaryCarry) ||
      !decimalEquals(accrualState.moratoryCarry, interest.cashInterestMoratoryCarry)
    ) return null;

    return totalDebtFunctional.minus(totalPaidFunctional).toString();
  } catch {
    return null;
  }
}

function decimalEquals(left: unknown, right: CashDecimal | null): boolean {
  if (left === null || left === undefined || right === null) return false;
  try {
    const value = new Prisma.Decimal(String(left));
    const expected = new Prisma.Decimal(right);
    return value.isFinite() && expected.isFinite() && value.eq(expected);
  } catch {
    return false;
  }
}

function persistedDecimal(value: Prisma.Decimal, scale: number): Prisma.Decimal {
  return value.toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP);
}

function matchesAllocationStart(
  payment: CashPaymentRecord,
  state: {
    accruedThroughDate: Date;
    principalRemaining: Prisma.Decimal;
    ordinaryAnnualRate: Prisma.Decimal;
    moratoryAnnualRate: Prisma.Decimal;
    ordinaryCarry: Prisma.Decimal;
    moratoryCarry: Prisma.Decimal;
  },
  interest: CashInterestSnapshot,
  obligationType: 'loan' | 'debt',
): boolean {
  const allocation = payment.cashInterestAllocation;
  return allocation !== null &&
    allocation.obligationType === obligationType &&
    allocation.policyVersion === 1 &&
    dateEquals(allocation.grantDate, interest.cashInterestGrantDate) &&
    dateEquals(allocation.maturityDate, interest.cashInterestMaturityDate) &&
    dateKey(payment.fechaReconciliacion) >= dateKey(state.accruedThroughDate) &&
    decimalEquals(allocation.principalBefore, state.principalRemaining) &&
    decimalEquals(allocation.ordinaryAnnualRate, state.ordinaryAnnualRate) &&
    decimalEquals(allocation.moratoryAnnualRate, state.moratoryAnnualRate) &&
    decimalEquals(allocation.ordinaryCarryBefore, state.ordinaryCarry) &&
    decimalEquals(allocation.moratoryCarryBefore, state.moratoryCarry);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateEquals(left: Date | null, right: Date | null): boolean {
  if (left === null || right === null) return left === right;
  return left instanceof Date && right instanceof Date &&
    left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

function roundedAccruedDelta(carryBefore: Prisma.Decimal, accruedThisPeriod: Prisma.Decimal) {
  const posting = carryBefore.plus(accruedThisPeriod)
    .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  const previouslyPosted = carryBefore.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  return posting.minus(previouslyPosted);
}

function asEvidenceRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
