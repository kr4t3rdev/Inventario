import { Prisma } from '@/generated/prisma';

import {
	CashInterestAccrualError,
	calculateOrdinaryInterestAccrual,
	allocateCashPaymentWithAnnualInterest,
	type CashOrdinaryInterestAccrual,
	type CashPaymentAnnualInterestAllocation,
} from './cash-interest-accrual';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export interface CashMoratoryInterestAccrualInput {
	overduePrincipal: unknown;
	annualRatePercent: unknown;
	elapsedDays: unknown;
	moratoryInterestUnpaid: unknown;
}

export interface CashMoratoryInterestAccrual {
	newMoratoryInterest: Prisma.Decimal;
	moratoryInterestUnrounded: Prisma.Decimal;
	moratoryInterestForPosting: Prisma.Decimal;
}

export interface CashPaymentAnnualAndMoratoryInterestInput {
	paymentAmount: unknown;
	principalRemaining: unknown;
	ordinaryAnnualRatePercent: unknown;
	ordinaryElapsedDays: unknown;
	ordinaryInterestUnpaid: unknown;
	overduePrincipal: unknown;
	moratoryAnnualRatePercent: unknown;
	moratoryElapsedDays: unknown;
	moratoryInterestUnpaid: unknown;
}

export interface CashPaymentAnnualAndMoratoryInterestAllocation {
	moratory: CashMoratoryInterestAccrual;
	moratoryInterestUnroundedRemaining: Prisma.Decimal;
	ordinary: CashOrdinaryInterestAccrual & {
		ordinaryInterestUnroundedRemaining: Prisma.Decimal;
	};
	allocation: CashPaymentAnnualInterestAllocation['allocation'];
}

/**
 * @description Devenga interés moratorio simple sin capitalizar intereses previos.
 * @param {CashMoratoryInterestAccrualInput} input - Principal vencido, tasa, días y arrastre explícitos.
 * @returns {CashMoratoryInterestAccrual} Arrastre exacto y cifra redondeada para posteo.
 */
export function calculateMoratoryInterestAccrual(
	input: CashMoratoryInterestAccrualInput,
): CashMoratoryInterestAccrual {
	const accrual = calculateOrdinaryInterestAccrual({
		principalRemaining: input.overduePrincipal,
		annualRatePercent: input.annualRatePercent,
		elapsedDays: input.elapsedDays,
		ordinaryInterestUnpaid: input.moratoryInterestUnpaid,
	});

	return {
		newMoratoryInterest: accrual.newOrdinaryInterest,
		moratoryInterestUnrounded: accrual.ordinaryInterestUnrounded,
		moratoryInterestForPosting: accrual.ordinaryInterestForPosting,
	};
}

/**
 * @description Distribuye el pago en moratorio, ordinario y principal con periodos explícitos.
 * @param {CashPaymentAnnualAndMoratoryInterestInput} input - Saldos, tasas y días resueltos.
 * @returns {CashPaymentAnnualAndMoratoryInterestAllocation} Devengos y asignación inmutables.
 */
export function allocateCashPaymentWithAnnualAndMoratoryInterest(
	input: CashPaymentAnnualAndMoratoryInterestInput,
): CashPaymentAnnualAndMoratoryInterestAllocation {
	const principalRemaining = parseNonNegativeDecimal(
		input.principalRemaining,
		'principalRemaining',
	);
	const overduePrincipal = parseNonNegativeDecimal(
		input.overduePrincipal,
		'overduePrincipal',
	);
	if (overduePrincipal.greaterThan(principalRemaining)) {
		throw new CashInterestAccrualError(
			'INVALID_ACCRUAL_INPUT',
			'overduePrincipal cannot exceed principalRemaining',
		);
	}

	const moratory = calculateMoratoryInterestAccrual({
		overduePrincipal: input.overduePrincipal,
		annualRatePercent: input.moratoryAnnualRatePercent,
		elapsedDays: input.moratoryElapsedDays,
		moratoryInterestUnpaid: input.moratoryInterestUnpaid,
	});
	const ordinary = allocateCashPaymentWithAnnualInterest({
		paymentAmount: input.paymentAmount,
		principalRemaining: input.principalRemaining,
		annualRatePercent: input.ordinaryAnnualRatePercent,
		elapsedDays: input.ordinaryElapsedDays,
		ordinaryInterestUnpaid: input.ordinaryInterestUnpaid,
		moratoryInterestDue: moratory.moratoryInterestForPosting,
	});
	const moratoryInterestUnroundedRemaining = moratory.moratoryInterestUnrounded.minus(
		ordinary.allocation.allocated.moratoryInterest,
	);

	return {
		moratory,
		moratoryInterestUnroundedRemaining: moratoryInterestUnroundedRemaining.isNegative()
			? new Prisma.Decimal(0)
			: moratoryInterestUnroundedRemaining,
		ordinary,
		allocation: ordinary.allocation,
	};
}

/**
 * @description Cuenta días calendario de mora desde el día posterior al vencimiento.
 * @param {unknown} maturityDate Fecha ISO YYYY-MM-DD de vencimiento.
 * @param {unknown} paymentDate Fecha ISO YYYY-MM-DD del pago.
 * @returns {number} Días vencidos, con cero hasta la fecha de vencimiento inclusive.
 */
export function calculateOverdueCalendarDays(maturityDate: unknown, paymentDate: unknown): number {
	const maturity = parseDateOnly(maturityDate, 'maturityDate');
	const payment = parseDateOnly(paymentDate, 'paymentDate');
	return Math.max(0, (payment - maturity) / DAY_IN_MILLISECONDS);
}

function parseDateOnly(value: unknown, field: string): number {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		throw new CashInterestAccrualError(
			'INVALID_ACCRUAL_INPUT',
			`${field} must be a valid YYYY-MM-DD date`,
		);
	}

	const [year, month, day] = value.split('-').map(Number);
	if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
		throw new CashInterestAccrualError(
			'INVALID_ACCRUAL_INPUT',
			`${field} must be a valid YYYY-MM-DD date`,
		);
	}

	const date = new Date(Date.UTC(2000, 0, 1));
	date.setUTCFullYear(year, month - 1, day);
	const timestamp = date.getTime();
	if (
		!Number.isFinite(timestamp)
		|| date.getUTCFullYear() !== year
		|| date.getUTCMonth() !== month - 1
		|| date.getUTCDate() !== day
	) {
		throw new CashInterestAccrualError(
			'INVALID_ACCRUAL_INPUT',
			`${field} must be a valid YYYY-MM-DD date`,
		);
	}
	return timestamp;
}

function parseNonNegativeDecimal(input: unknown, field: string): Prisma.Decimal {
	if (
		!(input instanceof Prisma.Decimal)
		&& typeof input !== 'string'
		&& typeof input !== 'number'
	) {
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
	if (!value.isFinite() || value.isNegative()) {
		throw new CashInterestAccrualError(
			value.isNegative() ? 'NEGATIVE_ACCRUAL_INPUT' : 'INVALID_ACCRUAL_INPUT',
			`${field} must be a finite non-negative decimal`,
		);
	}
	return value;
}
