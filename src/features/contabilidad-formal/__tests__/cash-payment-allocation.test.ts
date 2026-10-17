import { Prisma } from '@/generated/prisma';
import { describe, expect, it } from 'vitest';

import { allocateCashPaymentWaterfall } from '../lib/cash-payment-allocation';

describe('allocateCashPaymentWaterfall', () => {
	const snapshot = {
		moratoryDue: '0.0020',
		ordinaryAccruedDue: '0.0040',
		principalDue: '0.0100',
	};

	it('pays moratory interest, then ordinary interest, then principal with exact 4dp', () => {
		const result = allocateCashPaymentWaterfall(new Prisma.Decimal('0.0123'), snapshot);

		expect(result.allocated.moratoryInterest.toFixed(4)).toBe('0.0020');
		expect(result.allocated.ordinaryInterest.toFixed(4)).toBe('0.0040');
		expect(result.allocated.principal.toFixed(4)).toBe('0.0063');
		expect(result.remaining.moratoryInterest.toFixed(4)).toBe('0.0000');
		expect(result.remaining.ordinaryInterest.toFixed(4)).toBe('0.0000');
		expect(result.remaining.principal.toFixed(4)).toBe('0.0037');
	});

	it('allocates a partial payment to moratory interest before other balances', () => {
		const result = allocateCashPaymentWaterfall('0.0123', {
			moratoryDue: '0.0200',
			ordinaryAccruedDue: '0.0040',
			principalDue: '0.0100',
		});

		expect(result.allocated.moratoryInterest.toFixed(4)).toBe('0.0123');
		expect(result.allocated.ordinaryInterest.toFixed(4)).toBe('0.0000');
		expect(result.allocated.principal.toFixed(4)).toBe('0.0000');
		expect(result.remaining.moratoryInterest.toFixed(4)).toBe('0.0077');
	});

	it('pays ordinary accrued interest before principal when moratory balance is zero', () => {
		const result = allocateCashPaymentWaterfall('0.0123', {
			moratoryDue: '0.0000',
			ordinaryAccruedDue: '0.0100',
			principalDue: '0.0100',
		});

		expect(result.allocated.moratoryInterest.toFixed(4)).toBe('0.0000');
		expect(result.allocated.ordinaryInterest.toFixed(4)).toBe('0.0100');
		expect(result.allocated.principal.toFixed(4)).toBe('0.0023');
	});

	it('accepts an exact full payoff and preserves zero balances', () => {
		const result = allocateCashPaymentWaterfall('1.0000', {
			moratoryDue: '0.1000',
			ordinaryAccruedDue: '0.2000',
			principalDue: '0.7000',
		});

		expect(result.allocated.moratoryInterest.toFixed(4)).toBe('0.1000');
		expect(result.allocated.ordinaryInterest.toFixed(4)).toBe('0.2000');
		expect(result.allocated.principal.toFixed(4)).toBe('0.7000');
		expect(result.remaining.principal.toFixed(4)).toBe('0.0000');
	});

	it('rejects payments greater than the explicit outstanding snapshot', () => {
		expect(() => allocateCashPaymentWaterfall('1.0001', {
			moratoryDue: '0.1000',
			ordinaryAccruedDue: '0.2000',
			principalDue: '0.7000',
		})).toThrowError(expect.objectContaining({ code: 'OVERPAYMENT' }));
	});

	it.each([
		['negative payment', '-0.0001', snapshot],
		['zero payment', '0.0000', snapshot],
		['payment precision above four decimals', '0.00001', snapshot],
		['negative outstanding', '0.0010', { ...snapshot, ordinaryAccruedDue: '-0.0001' }],
		['outstanding precision above four decimals', '0.0010', { ...snapshot, ordinaryAccruedDue: '0.00001' }],
		['missing snapshot component', '0.0010', { moratoryDue: '0', principalDue: '1' }],
		['null snapshot component', '0.0010', { ...snapshot, ordinaryAccruedDue: null }],
		['unknown snapshot', '0.0010', null],
	])('rejects %s', (_label, amount, outstanding) => {
		expect(() => allocateCashPaymentWaterfall(amount, outstanding))
			.toThrowError(expect.objectContaining({ code: expect.any(String) }));
	});
});
