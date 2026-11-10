import {
	computeReplayPreflightDigest,
	REPLAY_PREFLIGHT_DIGEST_VERSION,
	type ReplayPreflightDigestSnapshot,
} from './replay-preflight-digest';
import { reconcileReplaySnapshot, type ReplayLedgerEvidence } from './replay-reconciliation';

interface SnapshotCoverageInput {
	tenantId: string;
	periodoId: string;
	replayRunId: string;
	snapshot: unknown;
	digest: string;
	digestVersion: number;
	entries: ReplayLedgerEvidence[];
}

/**
 * @description Comprueba que las fuentes actuales sigan coincidiendo con el snapshot aprobado.
 * @param {unknown} approved - Snapshot vinculado al replay.
 * @param {ReplayPreflightDigestSnapshot} current - Snapshot reconstruido en la misma transacción.
 * @param {string} digest - Digest aprobado.
 * @returns {boolean} Si las fuentes y su valoración no han cambiado.
 */
export function verifyCurrentSources(
	approved: unknown, current: ReplayPreflightDigestSnapshot, digest: string,
): boolean {
	try {
		const original = approved as ReplayPreflightDigestSnapshot;
		const clasificaciones = new Map(original.sources.map((source) => [
			JSON.stringify([source.identity.sourceType, source.identity.sourceId]), source.classification,
		]));
		const normalized = {
			...current,
			sources: current.sources.map((source) => {
				const anterior = clasificaciones.get(JSON.stringify([source.identity.sourceType, source.identity.sourceId]));
				return anterior === 'REPLAYABLE' && source.classification === 'YA_POSTEADO'
					? { ...source, classification: anterior } : source;
			}),
		};
		return computeReplayPreflightDigest(normalized, REPLAY_PREFLIGHT_DIGEST_VERSION) === digest;
	} catch (error) {
		if (error instanceof TypeError || error instanceof RangeError) return false;
		throw error;
	}
}

/**
 * @description Verifica que el snapshot aprobado explique cada asiento observado.
 * @param {SnapshotCoverageInput} input - Evidencia del replay y del mayor del período.
 * @returns {boolean} Si las identidades y la valoración siguen acreditadas.
 */
export function verifySnapshotCoverage(input: SnapshotCoverageInput): boolean {
	try {
		const snapshot = input.snapshot as ReplayPreflightDigestSnapshot;
		if (input.digestVersion !== 2 ||
			computeReplayPreflightDigest(snapshot, REPLAY_PREFLIGHT_DIGEST_VERSION) !== input.digest ||
			snapshot.tenantId !== input.tenantId || snapshot.period.periodId !== input.periodoId) return false;
		if (snapshot.sources.some((source) =>
			source.classification !== 'REPLAYABLE' && source.classification !== 'YA_POSTEADO')) return false;
		const identidades = new Set(snapshot.sources.map(({ identity }) =>
			JSON.stringify([identity.sourceType, identity.sourceId])));
		if (input.entries.length !== identidades.size || input.entries.some((entry) =>
			!identidades.has(JSON.stringify([entry.origenTipo, entry.origenId])))) return false;
		const resultado = reconcileReplaySnapshot(snapshot, input.entries, input.replayRunId);
		return resultado.status === 'CONFORME' && resultado.matchedCount === identidades.size;
	} catch (error) {
		if (error instanceof TypeError || error instanceof RangeError) return false;
		throw error;
	}
}
