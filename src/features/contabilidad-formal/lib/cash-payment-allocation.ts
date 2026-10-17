import { Prisma } from '@/generated/prisma';

const SCALE = 4;

export type CashPaymentAllocationErrorCode =
	| 'INVALID_PAYMENT_AMOUNT'
	| 'INVALID_OUTSTANDING_SNAPSHOT'
	| 'NEGATIVE_OUTSTANDING'
	| 'DECIMAL_PRECISION_EXCEEDED'
	| 'OVERPAYMENT';

export class CashPaymentAllocationError extends Error {
	constructor(readonly code: CashPaymentAllocationErrorCode, message: string) {
		super(message);
		this.name = 'CashPaymentAllocationError';
	}
}

export interface CashPaymentOutstandingSnapshot {
	moratoryDue: Prisma.Decimal | string | number;
	ordinaryAccruedDue: Prisma.Decimal | string | number;
	principalDue: Prisma.Decimal | string | number;
}

export interface CashPaymentAllocation {
	allocated: {
		moratoryInterest: Prisma.Decimal;
		ordinaryInterest: Prisma.Decimal;
		principal: Prisma.Decimal;
	};
	remaining: {
		moratoryInterest: Prisma.Decimal;
		ordinaryInterest: Prisma.Decimal;
		principal: Prisma.Decimal;
	};
}

/**
 * @description Distribuye un pago por la cascada moratorio, interés ordinario y principal.
 * @param {unknown} paymentAmountInput - Importe positivo del pago con precisión máxima de cuatro decimales.
 * @param {unknown} outstandingInput - Saldos explícitos y vigentes de cada componente de deuda.
 * @returns {CashPaymentAllocation} Distribución y saldos restantes sin mutar el snapshot.
 */
export function allocateCashPaymentWaterfall(
	paymentAmountInput: unknown,
	outstandingInput: unknown,
): CashPaymentAllocation {
	const paymentAmount = parseDecimal(paymentAmountInput, 'INVALID_PAYMENT_AMOUNT');
	if (paymentAmount.lte(0)) {
		throw new CashPaymentAllocationError('INVALID_PAYMENT_AMOUNT', 'Payment must be positive');
	}
	const outstanding = parseSnapshot(outstandingInput);
	const totalOutstanding = outstanding.moratoryInterest
		.plus(outstanding.ordinaryInterest)
		.plus(outstanding.principal);
	if (paymentAmount.gt(totalOutstanding)) {
		throw new CashPaymentAllocationError('OVERPAYMENT', 'Payment exceeds the supplied outstanding balances');
	}

	const moratoryInterest = Prisma.Decimal.min(paymentAmount, outstanding.moratoryInterest);
	const afterMoratory = paymentAmount.minus(moratoryInterest);
	const ordinaryInterest = Prisma.Decimal.min(afterMoratory, outstanding.ordinaryInterest);
	const principal = afterMoratory.minus(ordinaryInterest);

	return {
		allocated: { moratoryInterest, ordinaryInterest, principal },
		remaining: {
			moratoryInterest: outstanding.moratoryInterest.minus(moratoryInterest),
			ordinaryInterest: outstanding.ordinaryInterest.minus(ordinaryInterest),
			principal: outstanding.principal.minus(principal),
		},
	};
}

function parseSnapshot(input: unknown): {
	moratoryInterest: Prisma.Decimal;
	ordinaryInterest: Prisma.Decimal;
	principal: Prisma.Decimal;
} {
	if (typeof input !== 'object' || input === null || Array.isArray(input)) {
		throw new CashPaymentAllocationError(
			'INVALID_OUTSTANDING_SNAPSHOT',
			'Outstanding balances must be provided explicitly',
		);
	}
	const snapshot = input as Record<string, unknown>;
	const keys = ['moratoryDue', 'ordinaryAccruedDue', 'principalDue'] as const;
	if (keys.some((key) => !Object.prototype.hasOwnProperty.call(snapshot, key))) {
		throw new CashPaymentAllocationError(
			'INVALID_OUTSTANDING_SNAPSHOT',
			'Outstanding snapshot is missing a required balance',
		);
	}

	return {
		moratoryInterest: parseDecimal(snapshot.moratoryDue, 'INVALID_OUTSTANDING_SNAPSHOT', true),
		ordinaryInterest: parseDecimal(snapshot.ordinaryAccruedDue, 'INVALID_OUTSTANDING_SNAPSHOT', true),
		principal: parseDecimal(snapshot.principalDue, 'INVALID_OUTSTANDING_SNAPSHOT', true),
	};
}

function parseDecimal(
	input: unknown,
	invalidCode: 'INVALID_PAYMENT_AMOUNT' | 'INVALID_OUTSTANDING_SNAPSHOT',
	allowZero = false,
): Prisma.Decimal {
	if (!(input instanceof Prisma.Decimal) && typeof input !== 'string' && typeof input !== 'number') {
		throw new CashPaymentAllocationError(invalidCode, 'A finite decimal value is required');
	}

	let value: Prisma.Decimal;
	try {
		value = new Prisma.Decimal(input);
	} catch {
		throw new CashPaymentAllocationError(invalidCode, 'A finite decimal value is required');
	}
	if (!value.isFinite()) {
		throw new CashPaymentAllocationError(invalidCode, 'A finite decimal value is required');
	}
	if (value.decimalPlaces() > SCALE) {
		throw new CashPaymentAllocationError(
			'DECIMAL_PRECISION_EXCEEDED',
			`Amounts must have at most ${SCALE} decimal places`,
		);
	}
	if (value.isNegative() || (!allowZero && value.isZero())) {
		if (allowZero && value.isNegative()) {
			throw new CashPaymentAllocationError('NEGATIVE_OUTSTANDING', 'Outstanding balances cannot be negative');
		}
		if (!allowZero) {
			throw new CashPaymentAllocationError('INVALID_PAYMENT_AMOUNT', 'Payment must be positive');
		}
	}
	return value;
}
