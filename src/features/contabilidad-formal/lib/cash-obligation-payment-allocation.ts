import { Prisma } from '@/generated/prisma';

import { allocateCashPaymentWithAnnualAndMoratoryInterest } from './cash-moratory-accrual';
import { CashInterestAccrualError } from './cash-interest-accrual';

const DAY_MS = 86_400_000;

export class CashObligationInterestError extends Error {
	constructor(readonly code: 'INTEREST_SNAPSHOT_REQUIRED' | 'INVALID_ACCRUAL_INPUT', message: string) {
		super(message);
		this.name = 'CashObligationInterestError';
	}
}

export interface CashObligationInterestSnapshot {
	policyVersion: unknown;
	grantDate: unknown;
	maturityDate: unknown;
	accruedThroughDate: unknown;
	principalRemaining: unknown;
	ordinaryAnnualRate: unknown;
	moratoryAnnualRate: unknown;
	ordinaryCarry: unknown;
	moratoryCarry: unknown;
}

export interface CashObligationPaymentAllocationInput {
	obligation: CashObligationInterestSnapshot;
	paymentAmount: unknown;
	paymentDate: Date;
}

/**
 * @description Calcula el devengo y la asignación de una obligación con política versionada.
 * @param {CashObligationPaymentAllocationInput} input - Snapshot persistido y fecha del pago.
 * @returns {object} Asignación, devengos, días y saldo inmutable posterior al pago.
 */
export function calculateCashObligationPaymentAllocation(
	input: CashObligationPaymentAllocationInput,
) {
	const snapshot = input.obligation;
	if (
		snapshot.policyVersion !== 1
		|| snapshot.grantDate == null
		|| snapshot.accruedThroughDate == null
		|| snapshot.principalRemaining == null
		|| snapshot.ordinaryAnnualRate == null
		|| snapshot.moratoryAnnualRate == null
		|| snapshot.ordinaryCarry == null
		|| snapshot.moratoryCarry == null
	) {
		throw new CashObligationInterestError(
			'INTEREST_SNAPSHOT_REQUIRED',
			'La obligación no tiene una política de interés versionada completa',
		);
	}

	const grantDate = dateOnly(snapshot.grantDate, 'grantDate');
	const checkpointDate = dateOnly(snapshot.accruedThroughDate, 'accruedThroughDate');
	const paymentDate = dateOnly(input.paymentDate, 'paymentDate');
	const maturityDate = snapshot.maturityDate == null
		? null
		: dateOnly(snapshot.maturityDate, 'maturityDate');
	if (
		checkpointDate < grantDate
		|| (maturityDate !== null && maturityDate < grantDate)
		|| paymentDate < checkpointDate
	) {
		throw new CashObligationInterestError(
			'INVALID_ACCRUAL_INPUT',
			'Las fechas de devengo de la obligación no son consistentes',
		);
	}

	const ordinaryElapsedDays = daysBetween(checkpointDate, paymentDate);
	const moratoryStartDate = maturityDate === null || checkpointDate > maturityDate
		? checkpointDate
		: maturityDate;
	const moratoryElapsedDays = maturityDate === null || paymentDate <= moratoryStartDate
		? 0
		: daysBetween(moratoryStartDate, paymentDate);
	const principalRemaining = decimal(snapshot.principalRemaining, 'principalRemaining');
	const result = allocateCashPaymentWithAnnualAndMoratoryInterest({
		paymentAmount: input.paymentAmount,
		principalRemaining,
		ordinaryAnnualRatePercent: snapshot.ordinaryAnnualRate,
		ordinaryElapsedDays,
		ordinaryInterestUnpaid: snapshot.ordinaryCarry,
		overduePrincipal: moratoryElapsedDays > 0 ? principalRemaining : new Prisma.Decimal(0),
		moratoryAnnualRatePercent: snapshot.moratoryAnnualRate,
		moratoryElapsedDays,
		moratoryInterestUnpaid: snapshot.moratoryCarry,
	});

	return {
		grantDate: asDate(grantDate),
		maturityDate: maturityDate === null ? null : asDate(maturityDate),
		paymentDate: asDate(paymentDate),
		accruedThroughDate: asDate(paymentDate),
		ordinaryElapsedDays,
		moratoryElapsedDays,
		principalBefore: principalRemaining,
		ordinaryAnnualRate: decimal(snapshot.ordinaryAnnualRate, 'ordinaryAnnualRate'),
		moratoryAnnualRate: decimal(snapshot.moratoryAnnualRate, 'moratoryAnnualRate'),
		ordinaryCarryBefore: decimal(snapshot.ordinaryCarry, 'ordinaryCarry'),
		moratoryCarryBefore: decimal(snapshot.moratoryCarry, 'moratoryCarry'),
		overduePrincipalBefore: moratoryElapsedDays > 0 ? principalRemaining : new Prisma.Decimal(0),
		ordinaryAccruedThisPeriod: result.ordinary.newOrdinaryInterest,
		moratoryAccruedThisPeriod: result.moratory.newMoratoryInterest,
		ordinaryCarryAfter: result.ordinary.ordinaryInterestUnroundedRemaining,
		moratoryCarryAfter: result.moratoryInterestUnroundedRemaining,
		principalAfter: result.allocation.remaining.principal,
		allocation: result.allocation,
	};
}

function dateOnly(value: unknown, field: string): string {
	if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
		throw new CashObligationInterestError(
			'INVALID_ACCRUAL_INPUT',
			`${field} debe ser una fecha válida`,
		);
	}
	return value.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
	return (Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / DAY_MS;
}

function asDate(value: string): Date {
	return new Date(`${value}T00:00:00.000Z`);
}

function decimal(value: unknown, field: string): Prisma.Decimal {
	try {
		const result = new Prisma.Decimal(value as Prisma.Decimal.Value);
		if (result.isFinite() && !result.isNegative()) return result;
	} catch {
		// Report the same fail-closed validation error for malformed persisted snapshots.
	}
	throw new CashInterestAccrualError('INVALID_ACCRUAL_INPUT', `${field} must be non-negative`);
}
