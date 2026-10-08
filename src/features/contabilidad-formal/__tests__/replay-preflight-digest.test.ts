import { describe, expect, it } from 'vitest';
import {
	computeReplayPreflightDigest,
	type ReplayPreflightDigestSnapshot,
} from '@/features/contabilidad-formal/services/replay-preflight-digest';

const snapshot = (): ReplayPreflightDigestSnapshot => ({
	tenantId: 'tenant-1',
	period: {
		periodId: 'period-2026-09',
		startsAt: new Date('2026-09-01T00:00:00-04:00'),
		endsAt: new Date('2026-10-01T00:00:00-04:00'),
	},
	sources: [
		{
			identity: { sourceType: 'venta', sourceId: 'v-2' },
			classification: 'OMITTED',
			omissionCause: 'FX_NO_VERIFICABLE',
			semantics: {
				tipo: 'VENTA_CONTADO', fecha: new Date('2026-09-15T12:00:00Z'),
				descripcion: 'Venta', medioCobro: 'CAJA', referencia: 'ref-2',
				auxiliares: { costoFifo: null, intereses: null, montoPagado: null, diferenciaFx: null },
			},
			valuation: {
				originalAmount: '10.000',
				originalCurrency: 'USD',
				functionalAmount: '240.00',
				functionalCurrency: 'CUP',
				fxRate: '24.0000',
				fxEvidenceFingerprint: null,
			},
		},
		{
			identity: { sourceType: 'venta', sourceId: 'v-1' },
			classification: 'REPLAYABLE',
			omissionCause: null,
			semantics: {
				tipo: 'VENTA_CONTADO', fecha: new Date('2026-09-15T12:00:00Z'),
				descripcion: 'Venta', medioCobro: 'CAJA', referencia: null,
				auxiliares: { costoFifo: null, intereses: null, montoPagado: null, diferenciaFx: null },
			},
			valuation: {
				originalAmount: '10',
				originalCurrency: 'CUP',
				functionalAmount: '10',
				functionalCurrency: 'CUP',
				fxRate: null,
				fxEvidenceFingerprint: null,
			},
		},
	],
});

describe('replay preflight canonical digest', () => {
	it('is deterministic across source order, object-key order, and equivalent decimal/date forms', () => {
		const first = snapshot();
		const second = snapshot();
		second.sources.reverse();
		second.sources[0] = {
			valuation: {
				fxEvidenceFingerprint: null,
				fxRate: null,
				functionalCurrency: 'CUP',
				functionalAmount: '10.0000',
				originalCurrency: 'CUP',
				originalAmount: '10.0',
			},
			omissionCause: null,
			classification: 'REPLAYABLE',
			identity: { sourceId: 'v-1', sourceType: 'venta' },
			semantics: {
				tipo: 'VENTA_CONTADO', fecha: '2026-09-15T12:00:00.000Z',
				descripcion: 'Venta', medioCobro: 'CAJA', referencia: null,
				auxiliares: { costoFifo: null, intereses: null, montoPagado: null, diferenciaFx: null },
			},
		};
		second.period.startsAt = '2026-09-01T04:00:00.000Z';
		second.period.endsAt = '2026-10-01T04:00:00.000Z';

		expect(computeReplayPreflightDigest(first)).toBe(computeReplayPreflightDigest(second));
	});

	it('changes when valuation or omission cause changes', () => {
		const baseline = computeReplayPreflightDigest(snapshot());
		const changedValue = snapshot();
		changedValue.sources[0].valuation.functionalAmount = '241';
		const changedCause = snapshot();
		changedCause.sources[0].omissionCause = 'COSTO_NO_VERIFICABLE';

		expect(computeReplayPreflightDigest(changedValue)).not.toBe(baseline);
		expect(computeReplayPreflightDigest(changedCause)).not.toBe(baseline);
	});

	it('preserves unknown omitted valuation as null instead of inventing zero', () => {
		const unknown = snapshot();
		unknown.sources[0].valuation = {
			originalAmount: null,
			originalCurrency: null,
			functionalAmount: null,
			functionalCurrency: null,
			fxRate: null,
			fxEvidenceFingerprint: null,
		};
		const explicitZero = snapshot();
		explicitZero.sources[0].valuation = {
			originalAmount: '0',
			originalCurrency: 'CUP',
			functionalAmount: '0',
			functionalCurrency: 'CUP',
			fxRate: null,
			fxEvidenceFingerprint: null,
		};

		expect(computeReplayPreflightDigest(unknown)).not.toBe(
			computeReplayPreflightDigest(explicitZero),
		);
	});

	it.each([
		['tenant', (data: ReplayPreflightDigestSnapshot) => { data.tenantId = 'tenant-2'; }],
		['period identity', (data: ReplayPreflightDigestSnapshot) => { data.period.periodId = 'period-2'; }],
		['period boundary', (data: ReplayPreflightDigestSnapshot) => { data.period.endsAt = '2026-10-02T00:00:00Z'; }],
		['source identity', (data: ReplayPreflightDigestSnapshot) => { data.sources[0].identity.sourceId = 'v-3'; }],
		['original amount', (data: ReplayPreflightDigestSnapshot) => { data.sources[0].valuation.originalAmount = '11'; }],
		['original currency', (data: ReplayPreflightDigestSnapshot) => { data.sources[0].valuation.originalCurrency = 'EUR'; }],
		['functional currency', (data: ReplayPreflightDigestSnapshot) => { data.sources[0].valuation.functionalCurrency = 'EUR'; }],
		['FX rate', (data: ReplayPreflightDigestSnapshot) => { data.sources[0].valuation.fxRate = '25'; }],
		['FX evidence', (data: ReplayPreflightDigestSnapshot) => { data.sources[0].valuation.fxEvidenceFingerprint = 'evidence-2'; }],
		['classification', (data: ReplayPreflightDigestSnapshot) => { data.sources[0].classification = 'REPLAYABLE'; }],
		['business date', (data: ReplayPreflightDigestSnapshot) => { data.sources[0].semantics.fecha = new Date('2026-09-16T12:00:00Z'); }],
		['derived event type', (data: ReplayPreflightDigestSnapshot) => { data.sources[0].semantics.tipo = 'COBRO_PRESTAMO'; }],
		['event description', (data: ReplayPreflightDigestSnapshot) => { data.sources[0].semantics.descripcion = 'Changed description'; }],
		['payment medium', (data: ReplayPreflightDigestSnapshot) => { data.sources[0].semantics.medioCobro = 'BANCOS'; }],
		['reference', (data: ReplayPreflightDigestSnapshot) => { data.sources[0].semantics.referencia = 'changed'; }],
		['event auxiliary amount', (data: ReplayPreflightDigestSnapshot) => { data.sources[0].semantics.auxiliares.intereses = '1.25'; }],
	])('changes when %s changes', (_name, update) => {
		const changed = snapshot();
		update(changed);
		expect(computeReplayPreflightDigest(changed)).not.toBe(computeReplayPreflightDigest(snapshot()));
	});

	it('includes the digest schema version in the hashed content', () => {
		expect(computeReplayPreflightDigest(snapshot(), 'r5-v1')).not.toBe(
			computeReplayPreflightDigest(snapshot(), 'r5-v2'),
		);
	});

	it.each([
		{ name: 'non-decimal amount', update: (data: ReplayPreflightDigestSnapshot) => { data.sources[0].valuation.originalAmount = '1e999999'; } },
		{ name: 'empty original currency', update: (data: ReplayPreflightDigestSnapshot) => { data.sources[0].valuation.originalCurrency = ''; } },
		{ name: 'invalid date', update: (data: ReplayPreflightDigestSnapshot) => { data.period.startsAt = 'not-a-date'; } },
		{ name: 'timestamp without explicit timezone', update: (data: ReplayPreflightDigestSnapshot) => { data.period.startsAt = '2026-09-01T00:00:00'; } },
		{ name: 'sub-millisecond timestamp precision', update: (data: ReplayPreflightDigestSnapshot) => { data.period.startsAt = '2026-09-01T00:00:00.0001Z'; } },
		{ name: 'unsupported value type', update: (data: ReplayPreflightDigestSnapshot) => { (data.sources[0].valuation as unknown as Record<string, unknown>).fxRate = 24; } },
		{ name: 'duplicate source identity', update: (data: ReplayPreflightDigestSnapshot) => { data.sources[1].identity = { ...data.sources[0].identity }; } },
	])('rejects $name', ({ update }) => {
		const invalid = snapshot();
		update(invalid);
		expect(() => computeReplayPreflightDigest(invalid)).toThrow();
	});
});
