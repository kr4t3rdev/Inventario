import { describe, expect, it } from 'vitest';

import { calculateCashObligationPaymentAllocation } from '../lib/cash-obligation-payment-allocation';

const obligation = {
	policyVersion: 1,
	grantDate: new Date('2026-01-01T00:00:00.000Z'),
	maturityDate: new Date('2026-01-31T00:00:00.000Z'),
	accruedThroughDate: new Date('2026-01-01T00:00:00.000Z'),
	principalRemaining: '300.0000',
	ordinaryAnnualRate: '12',
	moratoryAnnualRate: '36',
	ordinaryCarry: '0',
	moratoryCarry: '0',
};

describe('calculateCashObligationPaymentAllocation', () => {
	it('accrues both interest types through payment day and allocates moratory first', () => {
		const result = calculateCashObligationPaymentAllocation({
			obligation,
			paymentAmount: '3.6900',
			paymentDate: new Date('2026-02-01T12:00:00.000Z'),
		});

		expect(result.ordinaryElapsedDays).toBe(31);
		expect(result.moratoryElapsedDays).toBe(1);
		expect(result.allocation.allocated.moratoryInterest.toFixed(4)).toBe('0.2959');
		expect(result.allocation.allocated.ordinaryInterest.toFixed(4)).toBe('3.0575');
		expect(result.allocation.allocated.principal.toFixed(4)).toBe('0.3366');
		expect(result.principalAfter.toFixed(4)).toBe('299.6634');
	});

	it('carries unrounded accrued interest and advances the date checkpoint', () => {
		const result = calculateCashObligationPaymentAllocation({
			obligation: { ...obligation, maturityDate: null },
			paymentAmount: '1.0000',
			paymentDate: new Date('2026-01-02T00:00:00.000Z'),
		});

		expect(result.ordinaryElapsedDays).toBe(1);
		expect(result.moratoryElapsedDays).toBe(0);
		expect(result.ordinaryCarryAfter.toString()).toBe('0.000030136986301369863');
		expect(result.accruedThroughDate.toISOString()).toBe('2026-01-02T00:00:00.000Z');
	});

	it('fails closed when the versioned policy snapshot is incomplete or stale', () => {
		expect(() => calculateCashObligationPaymentAllocation({
			obligation: { ...obligation, policyVersion: null },
			paymentAmount: '1.0000',
			paymentDate: new Date('2026-02-01T00:00:00.000Z'),
		})).toThrowError(expect.objectContaining({ code: 'INTEREST_SNAPSHOT_REQUIRED' }));

		expect(() => calculateCashObligationPaymentAllocation({
			obligation,
			paymentAmount: '1.0000',
			paymentDate: new Date('2025-12-31T00:00:00.000Z'),
		})).toThrowError(expect.objectContaining({ code: 'INVALID_ACCRUAL_INPUT' }));
	});
});
