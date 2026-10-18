import { Prisma } from '@/generated/prisma';
import { describe, expect, it } from 'vitest';

import {
	allocateCashPaymentWithAnnualAndMoratoryInterest,
	calculateMoratoryInterestAccrual,
	calculateOverdueCalendarDays,
} from '../lib/cash-moratory-accrual';

describe('calculateOverdueCalendarDays', () => {
	it('starts overdue accrual on the day after maturity', () => {
		expect(calculateOverdueCalendarDays('2026-04-10', '2026-04-10')).toBe(0);
		expect(calculateOverdueCalendarDays('2026-04-10', '2026-04-11')).toBe(1);
	});

	it('counts leap-day calendar intervals without timezone conversion', () => {
		expect(calculateOverdueCalendarDays('2024-02-28', '2024-03-01')).toBe(2);
		expect(calculateOverdueCalendarDays('2025-02-28', '2025-03-01')).toBe(1);
	});

	it('returns zero before maturity', () => {
		expect(calculateOverdueCalendarDays('2026-04-10', '2026-04-09')).toBe(0);
	});

	it.each([
		['non-ISO maturity', '04/10/2026', '2026-04-11'],
		['invalid maturity day', '2026-02-30', '2026-03-01'],
		['missing payment date', '2026-04-10', undefined],
	])('rejects %s', (_label, maturityDate, paymentDate) => {
		expect(() => calculateOverdueCalendarDays(maturityDate, paymentDate))
			.toThrowError(expect.objectContaining({ code: 'INVALID_ACCRUAL_INPUT' }));
	});
});

describe('calculateMoratoryInterestAccrual', () => {
	it('accrues annual simple interest on overdue principal for 365 days', () => {
		const result = calculateMoratoryInterestAccrual({
			overduePrincipal: '1000',
			annualRatePercent: '36.5',
			elapsedDays: 365,
			moratoryInterestUnpaid: '0',
		});

		expect(result.newMoratoryInterest.toFixed(4)).toBe('365.0000');
		expect(result.moratoryInterestUnrounded.toFixed(4)).toBe('365.0000');
		expect(result.moratoryInterestForPosting.toFixed(4)).toBe('365.0000');
	});

	it('allows an explicit zero rate and zero overdue interval', () => {
		const result = calculateMoratoryInterestAccrual({
			overduePrincipal: '100.0000',
			annualRatePercent: '0',
			elapsedDays: 0,
			moratoryInterestUnpaid: '1.2345',
		});

		expect(result.newMoratoryInterest.isZero()).toBe(true);
		expect(result.moratoryInterestUnrounded.toFixed(4)).toBe('1.2345');
	});

	it('does not capitalize prior unpaid moratory interest', () => {
		const result = calculateMoratoryInterestAccrual({
			overduePrincipal: '100.0000',
			annualRatePercent: '36.5',
			elapsedDays: 1,
			moratoryInterestUnpaid: '50.0000',
		});

		expect(result.newMoratoryInterest.toFixed(4)).toBe('0.1000');
		expect(result.moratoryInterestUnrounded.toFixed(4)).toBe('50.1000');
	});

	it('uses explicit reduced overdue principal for each checkpoint interval', () => {
		const result = calculateMoratoryInterestAccrual({
			overduePrincipal: '40',
			annualRatePercent: '36.5',
			elapsedDays: 1,
			moratoryInterestUnpaid: '0',
		});

		expect(result.newMoratoryInterest.toFixed(4)).toBe('0.0400');
	});

	it('retains unrounded moratory carry and rounds only the posting value half-up', () => {
		const result = calculateMoratoryInterestAccrual({
			overduePrincipal: '1',
			annualRatePercent: '18.25',
			elapsedDays: 1,
			moratoryInterestUnpaid: '0.00005',
		});

		expect(result.moratoryInterestUnrounded.toFixed(8)).toBe('0.00055000');
		expect(result.moratoryInterestForPosting.toFixed(4)).toBe('0.0006');
	});

	it.each([
		['missing rate', { annualRatePercent: undefined }],
		['negative rate', { annualRatePercent: '-0.01' }],
		['negative overdue principal', { overduePrincipal: '-0.01' }],
		['negative moratory carry', { moratoryInterestUnpaid: '-0.01' }],
		['fractional days', { elapsedDays: 0.5 }],
		['negative days', { elapsedDays: -1 }],
	])('rejects %s', (_label, overrides) => {
		expect(() => calculateMoratoryInterestAccrual({
			overduePrincipal: '1',
			annualRatePercent: '1',
			elapsedDays: 1,
			moratoryInterestUnpaid: '0',
			...overrides,
		})).toThrowError(expect.objectContaining({ code: expect.any(String) }));
	});
});

describe('allocateCashPaymentWithAnnualAndMoratoryInterest', () => {
	it('allocates moratory, ordinary, then principal using explicit accrual intervals', () => {
		const result = allocateCashPaymentWithAnnualAndMoratoryInterest({
			paymentAmount: '0.5030',
			principalRemaining: '100',
			ordinaryAnnualRatePercent: '36.5',
			ordinaryElapsedDays: 1,
			ordinaryInterestUnpaid: '0.2',
			overduePrincipal: '100',
			moratoryAnnualRatePercent: '36.5',
			moratoryElapsedDays: 1,
			moratoryInterestUnpaid: '0.2',
		});

		expect(result.moratory.newMoratoryInterest.toFixed(4)).toBe('0.1000');
		expect(result.ordinary.newOrdinaryInterest.toFixed(4)).toBe('0.1000');
		expect(result.allocation.allocated.moratoryInterest.toFixed(4)).toBe('0.3000');
		expect(result.allocation.allocated.ordinaryInterest.toFixed(4)).toBe('0.2030');
		expect(result.allocation.allocated.principal.toFixed(4)).toBe('0.0000');
		expect(result.moratoryInterestUnroundedRemaining.toFixed(4)).toBe('0.0000');
		expect(result.ordinary.ordinaryInterestUnroundedRemaining.toFixed(4)).toBe('0.0970');
	});

	it('rejects overdue principal greater than the remaining obligation principal', () => {
		expect(() => allocateCashPaymentWithAnnualAndMoratoryInterest({
			paymentAmount: '1',
			principalRemaining: '10',
			ordinaryAnnualRatePercent: '0',
			ordinaryElapsedDays: 0,
			ordinaryInterestUnpaid: '0',
			overduePrincipal: '10.0001',
			moratoryAnnualRatePercent: '1',
			moratoryElapsedDays: 1,
			moratoryInterestUnpaid: '0',
		})).toThrowError(expect.objectContaining({ code: 'INVALID_ACCRUAL_INPUT' }));
	});

	it('rounds 4dp exactly once at the posting boundary', () => {
		const result = calculateMoratoryInterestAccrual({
			overduePrincipal: new Prisma.Decimal('1'),
			annualRatePercent: '18.25',
			elapsedDays: 1,
			moratoryInterestUnpaid: '0',
		});
		expect(result.moratoryInterestForPosting.toFixed(4)).toBe('0.0005');
	});
});
