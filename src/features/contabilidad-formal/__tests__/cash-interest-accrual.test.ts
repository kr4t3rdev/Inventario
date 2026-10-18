import { Prisma } from '@/generated/prisma';
import { describe, expect, it } from 'vitest';

import {
	allocateCashPaymentWithAnnualInterest,
	calculateOrdinaryInterestAccrual,
} from '../lib/cash-interest-accrual';

describe('allocateCashPaymentWithAnnualInterest', () => {
	const base = {
		paymentAmount: '0.0001',
		principalRemaining: '100.0000',
		annualRatePercent: '10',
		elapsedDays: 365,
		ordinaryInterestUnpaid: '0',
		moratoryInterestDue: '0',
	};

	it('accrues the annual percentage against outstanding principal over 365 days', () => {
		const result = allocateCashPaymentWithAnnualInterest({
			...base,
			paymentAmount: '110.0000',
			principalRemaining: '1000.0000',
		});

		expect(result.newOrdinaryInterest.toFixed(4)).toBe('100.0000');
		expect(result.ordinaryInterestUnrounded.toFixed(4)).toBe('100.0000');
		expect(result.ordinaryInterestForPosting.toFixed(4)).toBe('100.0000');
		expect(result.allocation.allocated.ordinaryInterest.toFixed(4)).toBe('100.0000');
		expect(result.allocation.allocated.principal.toFixed(4)).toBe('10.0000');
	});

	it('uses the fixed 365 denominator for 366 elapsed days', () => {
		const result = allocateCashPaymentWithAnnualInterest({
			...base,
			paymentAmount: '1100.2740',
			principalRemaining: '1000.0000',
			elapsedDays: 366,
		});

		expect(result.newOrdinaryInterest.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
			.toFixed(4)).toBe('100.2740');
		expect(result.ordinaryInterestForPosting.toFixed(4)).toBe('100.2740');
	});

	it('accrues zero for zero elapsed days and keeps prior ordinary interest uncapitalized', () => {
		const result = calculateOrdinaryInterestAccrual({
			principalRemaining: '100.0000',
			annualRatePercent: '50',
			elapsedDays: 0,
			ordinaryInterestUnpaid: '12.3456',
		});

		expect(result.newOrdinaryInterest.isZero()).toBe(true);
		expect(result.ordinaryInterestUnrounded.toFixed(4)).toBe('12.3456');
		expect(result.ordinaryInterestForPosting.toFixed(4)).toBe('12.3456');
	});

	it('bases new interest only on remaining principal, not unpaid ordinary interest', () => {
		const result = calculateOrdinaryInterestAccrual({
			principalRemaining: '100.0000',
			annualRatePercent: '10',
			elapsedDays: 365,
			ordinaryInterestUnpaid: '25.0000',
		});

		expect(result.newOrdinaryInterest.toFixed(4)).toBe('10.0000');
		expect(result.ordinaryInterestUnrounded.toFixed(4)).toBe('35.0000');
	});

	it('uses a reduced principal balance for accrual after a prior payment', () => {
		const result = calculateOrdinaryInterestAccrual({
			principalRemaining: '50.0000',
			annualRatePercent: '10',
			elapsedDays: 365,
			ordinaryInterestUnpaid: '0',
		});

		expect(result.newOrdinaryInterest.toFixed(4)).toBe('5.0000');
	});

	it('allocates moratory, then accrued ordinary interest, then principal', () => {
		const outstandingSnapshot = {
			principalRemaining: '100.0000',
			ordinaryInterestUnpaid: '0.2000',
			moratoryInterestDue: '0.2000',
		};
		const result = allocateCashPaymentWithAnnualInterest({
			...base,
			paymentAmount: '0.5030',
			annualRatePercent: '36.5',
			elapsedDays: 1,
			...outstandingSnapshot,
		});

		expect(result.newOrdinaryInterest.toFixed(4)).toBe('0.1000');
		expect(result.ordinaryInterestForPosting.toFixed(4)).toBe('0.3000');
		expect(result.allocation.allocated.moratoryInterest.toFixed(4)).toBe('0.2000');
		expect(result.allocation.allocated.ordinaryInterest.toFixed(4)).toBe('0.3000');
		expect(result.allocation.allocated.principal.toFixed(4)).toBe('0.0030');
		expect(outstandingSnapshot).toEqual({
			principalRemaining: '100.0000',
			ordinaryInterestUnpaid: '0.2000',
			moratoryInterestDue: '0.2000',
		});
	});

	it('preserves the unrounded ordinary-interest carry after a partial interest payment', () => {
		const result = allocateCashPaymentWithAnnualInterest({
			...base,
			paymentAmount: '0.0010',
			principalRemaining: '100.0000',
			annualRatePercent: '1',
			elapsedDays: 1,
		});

		expect(result.ordinaryInterestForPosting.toFixed(4)).toBe('0.0027');
		expect(result.allocation.allocated.ordinaryInterest.toFixed(4)).toBe('0.0010');
		expect(result.ordinaryInterestUnroundedRemaining.toFixed(12)).toBe('0.001739726027');
	});

	it('rounds accumulated interest half-up only at final posting precision', () => {
		const result = allocateCashPaymentWithAnnualInterest({
			...base,
			paymentAmount: '0.0001',
			principalRemaining: '100.0000',
			annualRatePercent: '0',
			elapsedDays: 0,
			ordinaryInterestUnpaid: '0.00005',
		});

		expect(result.ordinaryInterestUnrounded.toFixed(5)).toBe('0.00005');
		expect(result.ordinaryInterestForPosting.toFixed(4)).toBe('0.0001');
		expect(result.allocation.allocated.ordinaryInterest.toFixed(4)).toBe('0.0001');
		expect(result.ordinaryInterestUnroundedRemaining.isZero()).toBe(true);
	});

	it('produces the same final four-place amount for a partitioned interval', () => {
		const whole = calculateOrdinaryInterestAccrual({
			principalRemaining: '123.4500',
			annualRatePercent: '7.25',
			elapsedDays: 365,
			ordinaryInterestUnpaid: '0',
		});
		const firstInterval = calculateOrdinaryInterestAccrual({
			principalRemaining: '123.4500',
			annualRatePercent: '7.25',
			elapsedDays: 123,
			ordinaryInterestUnpaid: '0',
		});
		const secondInterval = calculateOrdinaryInterestAccrual({
			principalRemaining: '123.4500',
			annualRatePercent: '7.25',
			elapsedDays: 242,
			ordinaryInterestUnpaid: firstInterval.ordinaryInterestUnrounded,
		});

		expect(whole.ordinaryInterestForPosting.toFixed(4)).toBe('8.9501');
		expect(secondInterval.ordinaryInterestForPosting.toFixed(4))
			.toBe(whole.ordinaryInterestForPosting.toFixed(4));
	});

	it.each([
		['negative principal', { ...base, principalRemaining: '-0.0001' }],
		['non-finite principal', { ...base, principalRemaining: Number.POSITIVE_INFINITY }],
		['negative annual rate', { ...base, annualRatePercent: '-0.01' }],
		['non-finite annual rate', { ...base, annualRatePercent: Number.NaN }],
		['negative unpaid interest', { ...base, ordinaryInterestUnpaid: '-0.0001' }],
		['fractional elapsed days', { ...base, elapsedDays: 1.5 }],
		['negative elapsed days', { ...base, elapsedDays: -1 }],
		['non-finite elapsed days', { ...base, elapsedDays: Number.POSITIVE_INFINITY }],
		['missing elapsed days', { ...base, elapsedDays: undefined }],
	])('rejects %s', (_label, input) => {
		expect(() => allocateCashPaymentWithAnnualInterest(input))
			.toThrowError(expect.objectContaining({ code: expect.any(String) }));
	});
});
