import { describe, expect, it } from 'vitest';
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';
import {
	computeAperturaPreflightDigest,
	validateAperturaPreflight,
	computeAperturaEvidenceHash,
	type AperturaEvidenceSnapshot,
} from '@/features/contabilidad-formal/services/apertura-evidencia';

const snapshot = (): AperturaEvidenceSnapshot => ({
	tenantId: 'tenant-1', periodId: 'period-1', openingDate: '2026-01-01T00:00:00Z',
	functionalCurrency: 'CUP',
	lines: [
		{ tenantId: 'tenant-1', role: 'CASH', accountId: 'cash', currency: 'CUP', amount: '10.0000',
			debit: '10', credit: '0', source: { kind: 'MANUAL', evidenceVersion: 1, sourceId: 'opening-cash', snapshot: { declaredBy: 'actor-1', note: 'statement' }, hash: '' } },
		{ tenantId: 'tenant-1', role: 'EQUITY', accountId: 'equity', currency: 'CUP', amount: '10',
			debit: '0', credit: '10', source: { kind: 'MANUAL', evidenceVersion: 1, sourceId: 'opening-equity', snapshot: { declaredBy: 'actor-1', note: 'statement' }, hash: '' } },
	],
});

const sourceHash = computeAperturaEvidenceHash;

describe('opening evidence validation and digest', () => {
	it('accepts valid exact CUP lines and creates stable digest regardless of line order', () => {
		const data = snapshot();
		data.lines = data.lines.map((line) => ({ ...line, source: { ...line.source, hash: sourceHash(line.source) } }));
		const reversed = { ...data, lines: [...data.lines].reverse() };
		expect(validateAperturaPreflight(data)).toEqual({ valid: true, issues: [] });
		expect(computeAperturaPreflightDigest(data)).toBe(computeAperturaPreflightDigest(reversed));
	});

	it.each(['cross-tenant', 'bad-provenance', 'duplicate', 'precision', 'currency', 'unbalanced', 'fx-missing', 'whitespace-duplicate', 'native-mismatch', 'bad-snapshot'])('rejects %s', (caseName) => {
		const data = snapshot();
		data.lines = data.lines.map((line) => ({ ...line, source: { ...line.source, hash: sourceHash(line.source) } }));
		if (caseName === 'cross-tenant') data.lines[0].tenantId = 'other';
		if (caseName === 'bad-provenance') data.lines[0].source.hash = 'f'.repeat(64);
		if (caseName === 'duplicate') data.lines[1].accountId = data.lines[0].accountId;
		if (caseName === 'whitespace-duplicate') {
			data.lines[0].currency = 'cup'; data.lines[1].accountId = 'cash'; data.lines[1].currency = ' CUP ';
		}
		if (caseName === 'precision') data.lines[0].amount = '1.00001';
		if (caseName === 'native-mismatch') data.lines[0].amount = '9';
		if (caseName === 'bad-snapshot') data.lines[0].source.snapshot = {};
		if (caseName === 'currency') data.lines[0].currency = 'XYZ';
		if (caseName === 'unbalanced') data.lines[0].credit = '1';
		if (caseName === 'fx-missing') data.lines[0].currency = 'USD';
		expect(validateAperturaPreflight(data).valid).toBe(false);
	});

	it.each(['detached-side', 'rate-precision'])('rejects foreign %s', (caseName) => {
		const data = snapshot();
		const rate = '24';
		const fx = buildAppliedFxEvidenceExact({ originalAmount: '2', originalCurrency: 'USD',
			functionalCurrency: 'CUP', exchangeRate: rate, convertedAmount: '48',
			rateEffectiveAt: new Date('2026-01-01T00:00:00Z'), source: 'catalog:1', fxProvenanceKind: 'CATALOG_RATE' });
		data.lines[0] = { ...data.lines[0], currency: 'USD', amount: '2', debit: '48', credit: '0',
			fx: { functionalAmount: fx.montoConvertido.toFixed(), rate, rateDate: '2026-01-01T00:00:00Z',
				source: 'catalog:1', provenanceKind: 'CATALOG_RATE', fingerprint: fx.evidence.fxEvidenceFingerprint } };
		data.lines[1].amount = caseName === 'rate-precision' ? fx.montoConvertido.toFixed() : '48';
		data.lines[1].credit = data.lines[1].amount;
		if (caseName === 'detached-side') data.lines[0].debit = '47';
		if (caseName === 'rate-precision') data.lines[0].fx!.rate = '24.00000000001';
		data.lines = data.lines.map((line) => ({ ...line, source: { ...line.source, hash: sourceHash(line.source) } }));
		expect(validateAperturaPreflight(data).valid).toBe(false);
	});
});
