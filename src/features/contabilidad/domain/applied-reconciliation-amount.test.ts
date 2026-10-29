import { describe, expect, it } from 'vitest';
import { resolveAppliedReconciliationAmount } from './applied-reconciliation-amount';
import { buildAppliedFxEvidence } from './fx-evidence';

describe('resolveAppliedReconciliationAmount', () => {
	it('uses persisted conversion only when canonical evidence verifies', () => {
		const fxEvidence = buildAppliedFxEvidence({
			originalAmount: 20,
			originalCurrency: 'USD',
			functionalCurrency: 'CUP',
			exchangeRate: 25,
			convertedAmount: 500,
			rateEffectiveAt: new Date('2026-01-01T00:00:00.000Z'),
			source: 'test',
		});
		expect(resolveAppliedReconciliationAmount({
			monto: 20,
			montoConvertido: 500,
			moneda: 'USD',
			tasaCambio: 25,
			...fxEvidence,
		})).toBe(500);
	});

	it('rejects converted amounts with a tampered fingerprint', () => {
		const fxEvidence = buildAppliedFxEvidence({
			originalAmount: 20,
			originalCurrency: 'USD',
			functionalCurrency: 'CUP',
			exchangeRate: 25,
			convertedAmount: 500,
			rateEffectiveAt: new Date('2026-01-01T00:00:00.000Z'),
			source: 'test',
		});
		expect(resolveAppliedReconciliationAmount({
			monto: 20,
			montoConvertido: 500,
			moneda: 'USD',
			tasaCambio: 25,
			...fxEvidence,
			fxEvidenceFingerprint: '0'.repeat(64),
		})).toBeNull();
	});

	it('accepts same-currency amount when functional currency is explicit', () => {
		expect(resolveAppliedReconciliationAmount({
			monto: 20,
			montoConvertido: 20,
			moneda: 'USD',
			tasaCambio: 1,
			...buildAppliedFxEvidence({
				originalAmount: 20,
				originalCurrency: 'USD',
				functionalCurrency: 'USD',
				source: 'test',
			}),
		})).toBe(20);
	});

	it('returns unknown instead of using nominal FX without conversion evidence', () => {
		expect(resolveAppliedReconciliationAmount({
			monto: 20,
			montoConvertido: 500,
			moneda: 'USD',
			functionalCurrency: 'CUP',
		})).toBeNull();
	});

	it('does not assume CUP when functional currency is missing', () => {
		expect(resolveAppliedReconciliationAmount({ monto: 20, moneda: 'CUP' })).toBeNull();
	});

	it('uses a persisted positive legacy rate when conversion amount is missing', () => {
		expect(resolveAppliedReconciliationAmount({
			monto: 20, moneda: 'USD', functionalCurrency: 'CUP', tasaCambio: 25,
		})).toBeNull();
	});
});
