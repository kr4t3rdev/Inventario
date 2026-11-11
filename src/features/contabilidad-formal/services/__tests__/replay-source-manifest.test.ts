import { describe, expect, it } from 'vitest';
import { DIARIO_POR_EVENTO } from '@/features/contabilidad-formal/lib/plan-default';
import {
	buildReplayManifestEvidence,
	isReplayManifestSnapshotComplete,
	REPLAY_COLLECTOR_QUERY_IDS,
	REPLAY_SOURCE_MANIFEST,
} from '../replay-source-manifest';

describe('replay source manifest', () => {
	it('classifies every formal event and keeps non-replay events explicit', () => {
		const eventTypes = Object.keys(REPLAY_SOURCE_MANIFEST).sort();
		expect(eventTypes).toEqual(Object.keys(DIARIO_POR_EVENTO).sort());
		expect(Object.values(REPLAY_SOURCE_MANIFEST).filter((entry) => entry.disposition === 'replay'))
			.toHaveLength(29);
		expect(Object.values(REPLAY_SOURCE_MANIFEST).filter((entry) => entry.disposition === 'programmatic'))
			.toHaveLength(2);
		expect(Object.values(REPLAY_SOURCE_MANIFEST).filter((entry) => entry.disposition === 'template-only'))
			.toHaveLength(8);
	});

	it('accepts only replay candidates from registered origin types', () => {
		const valid = buildReplayManifestEvidence([{
			tipo: 'VENTA_CREDITO',
			origenTipo: 'factura',
		}], REPLAY_COLLECTOR_QUERY_IDS);
		const invalid = buildReplayManifestEvidence([{
			tipo: 'VENTA_CREDITO',
			origenTipo: 'origen-desconocido',
		}]);

		expect(valid.unclassifiedCount).toBe(0);
		expect(invalid.unclassifiedCount).toBe(1);
	});

	it('marks required families unevaluated when the collector registry is incomplete', () => {
		const evidence = buildReplayManifestEvidence([], []);

		expect(evidence.complete).toBe(false);
		expect(evidence.unclassifiedCount).toBe(0);
		expect(evidence.evaluatedEventTypes).toHaveLength(0);
	});

	it('does not credit a family when one of its real source queries did not execute', () => {
		const executedQueries = REPLAY_COLLECTOR_QUERY_IDS.filter(
			(queryId) => queryId !== 'ordenProduccion',
		);
		const evidence = buildReplayManifestEvidence([], executedQueries);

		expect(evidence.complete).toBe(false);
		expect(evidence.requiredQueryIds).toContain('ordenProduccion');
		expect(evidence.evaluatedQueryIds).not.toContain('ordenProduccion');
		expect(evidence.evaluatedEventTypes).not.toContain('PRODUCCION_SALIDA');
	});

	it('invalidates a preflight snapshot when the source mapping fingerprint changes', () => {
		const { complete: _complete, ...snapshot } = buildReplayManifestEvidence(
			[], REPLAY_COLLECTOR_QUERY_IDS,
		);

		expect(isReplayManifestSnapshotComplete(snapshot)).toBe(true);
		expect(isReplayManifestSnapshotComplete({ ...snapshot, fingerprint: 'stale' })).toBe(false);
		expect(isReplayManifestSnapshotComplete({
			...snapshot,
			evaluatedQueryIds: snapshot.evaluatedQueryIds.filter((queryId) => queryId !== 'ordenProduccion'),
		})).toBe(false);
	});
});
