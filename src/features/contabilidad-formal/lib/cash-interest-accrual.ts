import { Prisma } from '@/generated/prisma';

import {
	allocateCashPaymentWaterfall,
	type CashPaymentAllocation,
} from './cash-payment-allocation';

const POSTING_SCALE = 4;
const FIXED_YEAR_DAYS = 365;

export type CashInterestAccrualErrorCode =
	| 'INVALID_ACCRUAL_INPUT'
	| 'NEGATIVE_ACCRUAL_INPUT'
	| 'INVALID_ELAPSED_DAYS';

export class CashInterestAccrualError extends Error {
	constructor(readonly code: CashInterestAccrualErrorCode, message: string) {
		super(message);
		this.name = 'CashInterestAccrualError';
	}
}

export interface CashPaymentAnnualInterestInput {
	paymentAmount: unknown;
	principalRemaining: unknown;
	annualRatePercent: unknown;
	elapsedDays: unknown;
	ordinaryInterestUnpaid: unknown;
	moratoryInterestDue: unknown;
}

export interface CashOrdinaryInterestAccrualInput {
	principalRemaining: unknown;
	annualRatePercent: unknown;
	elapsedDays: unknown;
	ordinaryInterestUnpaid: unknown;
}

export interface CashOrdinaryInterestAccrual {
	newOrdinaryInterest: Prisma.Decimal;
	ordinaryInterestUnrounded: Prisma.Decimal;
	ordinaryInterestForPosting: Prisma.Decimal;
}

export interface CashPaymentAnnualInterestAllocation {
	ordinaryInterestUnroundedRemaining: Prisma.Decimal;
	allocation: CashPaymentAllocation;
}

/**
 * @description Calcula interés simple anual sobre el principal pendiente y distribuye el pago.
 * @param {CashPaymentAnnualInterestInput} input - Saldos explícitos y días ya resueltos.
 * @returns {CashPaymentAnnualInterestAllocation} Devengo sin redondear y asignación a cuatro decimales.
 */
export function allocateCashPaymentWithAnnualInterest(
	input: CashPaymentAnnualInterestInput,
): CashPaymentAnnualInterestAllocation & CashOrdinaryInterestAccrual {
	const accrual = calculateOrdinaryInterestAccrual(input);
	const allocation = allocateCashPaymentWaterfall(input.paymentAmount, {
		moratoryDue: input.moratoryInterestDue,
		ordinaryAccruedDue: accrual.ordinaryInterestForPosting,
		principalDue: input.principalRemaining,
	});
	const unroundedRemaining = accrual.ordinaryInterestUnrounded.minus(
		allocation.allocated.ordinaryInterest,
	);

	return {
		...accrual,
		ordinaryInterestUnroundedRemaining: unroundedRemaining.isNegative()
			? new Prisma.Decimal(0)
			: unroundedRemaining,
		allocation,
	};
}

/**
 * @description Devenga interés simple anual usando solo el principal pendiente como base.
 * @param {CashOrdinaryInterestAccrualInput} input - Principal, tasa anual, días y saldo ordinario previo.
 * @returns {CashOrdinaryInterestAccrual} Devengo acumulado sin redondear y cifra final de posteo.
 */
export function calculateOrdinaryInterestAccrual(
	input: CashOrdinaryInterestAccrualInput,
): CashOrdinaryInterestAccrual {
	const principalRemaining = parseNonNegative(input.principalRemaining, 'principalRemaining');
	const annualRatePercent = parseNonNegative(input.annualRatePercent, 'annualRatePercent');
	const ordinaryInterestUnpaid = parseNonNegative(
		input.ordinaryInterestUnpaid,
		'ordinaryInterestUnpaid',
	);
	const elapsedDays = parseElapsedDays(input.elapsedDays);

	// Unpaid ordinary interest is carried but never included in the accrual base.
	const newOrdinaryInterest = principalRemaining
		.times(annualRatePercent)
		.times(elapsedDays)
		.dividedBy(100 * FIXED_YEAR_DAYS);
	const ordinaryInterestUnrounded = ordinaryInterestUnpaid.plus(newOrdinaryInterest);
	const ordinaryInterestForPosting = ordinaryInterestUnrounded.toDecimalPlaces(
		POSTING_SCALE,
		Prisma.Decimal.ROUND_HALF_UP,
	);

	return {
		newOrdinaryInterest,
		ordinaryInterestUnrounded,
		ordinaryInterestForPosting,
	};
}

function parseNonNegative(input: unknown, field: string): Prisma.Decimal {
	if (!(input instanceof Prisma.Decimal) && typeof input !== 'string' && typeof input !== 'number') {
		throw new CashInterestAccrualError(
			'INVALID_ACCRUAL_INPUT',
			`${field} must be a finite decimal`,
		);
	}

	let value: Prisma.Decimal;
	try {
		value = new Prisma.Decimal(input);
	} catch {
		throw new CashInterestAccrualError(
			'INVALID_ACCRUAL_INPUT',
			`${field} must be a finite decimal`,
		);
	}
	if (!value.isFinite()) {
		throw new CashInterestAccrualError(
			'INVALID_ACCRUAL_INPUT',
			`${field} must be a finite decimal`,
		);
	}
	if (value.isNegative()) {
		throw new CashInterestAccrualError('NEGATIVE_ACCRUAL_INPUT', `${field} cannot be negative`);
	}
	return value;
}

function parseElapsedDays(input: unknown): number {
	if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < 0) {
		throw new CashInterestAccrualError(
			'INVALID_ELAPSED_DAYS',
			'elapsedDays must be a non-negative safe integer',
		);
	}
	return input;
}
