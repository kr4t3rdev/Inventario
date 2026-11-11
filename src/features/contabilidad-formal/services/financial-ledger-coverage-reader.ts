import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import type { EvidenciaCobertura, EvidenciaReplay } from './financial-ledger-coverage';
import { verifyCurrentSources, verifySnapshotCoverage } from './snapshot-coverage-integrity';
import { snapshotPeriodo, type ContextoSnapshotPeriodoLazy } from './replay-backfill-service';
import { isReplayManifestSnapshotComplete } from './replay-source-manifest';

/** Parámetros de lectura de la evidencia de cobertura. */
export interface CoverageEvidenceParams {
	/** Tenant propietario del mayor formal. */
	tenantId: string;
	/** Período contable evaluado. */
	periodoId: string;
	/** Cliente transaccional opcional para leer en el mismo contexto. */
	client?: Prisma.TransactionClient;
	/**
	 * Contexto de reconstrucción compartido: evita que cada período evaluado
	 * recolecte de nuevo todas las fuentes del tenant.
	 */
	contexto?: ContextoSnapshotPeriodoLazy;
}

/**
 * @description Extrae la reconciliación persistida en el diagnóstico del replay.
 * @param {unknown} diagnostic - Diagnóstico persistido en la ejecución.
 * @returns {EvidenciaReplay['reconciliacion']} Reconciliación leída o null si no existe.
 */
function leerReconciliacion(
	diagnostic: unknown,
): EvidenciaReplay['reconciliacion'] {
	if (!diagnostic || typeof diagnostic !== 'object') return null;
	const contenedor = diagnostic as { reconciliation?: unknown };
	if (!contenedor.reconciliation || typeof contenedor.reconciliation !== 'object') return null;
	const campos = contenedor.reconciliation as Record<string, unknown>;
	if (
		typeof campos.status !== 'string' ||
		typeof campos.expectedCount !== 'number' ||
		typeof campos.matchedCount !== 'number'
	) {
		return null;
	}
	return {
		status: campos.status,
		expectedCount: campos.expectedCount,
		matchedCount: campos.matchedCount,
	};
}

/**
 * @description Reúne la evidencia durable de cobertura global de un período:
 * la ejecución de replay que reconstruyó el período y el libro formal que
 * resulted de ella.
 *
 * @param {CoverageEvidenceParams} params - Tenant y período evaluados.
 * @returns {Promise<EvidenciaCobertura>} Evidencia para evaluar la cobertura.
 */
export async function readCoverageEvidence(
	params: CoverageEvidenceParams,
): Promise<EvidenciaCobertura> {
	if (!params.tenantId.trim() || !params.periodoId.trim()) {
		throw new Error('El tenant y el período son obligatorios para leer la evidencia');
	}

	// El contexto compartido reconstruyó sus fuentes con su propio cliente:
	// si el llamador trae otro cliente, se mezclarian dos instantaneas
	// distintas de la base de datos.
	if (params.contexto && params.client && params.contexto.client !== params.client) {
		throw new Error('El contexto de snapshot pertenece a otro cliente de base de datos');
	}
	const db = params.client ?? params.contexto?.client ?? prisma;
	const [run, asientosEnPeriodo, fuentesProduccionNoEvaluables] = await Promise.all([
		db.replayRun.findFirst({
			where: { tenantId: params.tenantId, preflight: { periodoId: params.periodoId } },
			orderBy: { startedAt: 'desc' },
			select: {
				replayRunId: true,
				status: true,
				omittedCount: true,
				ambiguousCount: true,
				noFxCount: true,
				noCostCount: true,
				outOfPeriodCount: true,
				diagnostic: true,
				preflight: { select: { snapshot: true, digest: true, digestVersion: true } },
			},
		}),
		db.asiento.count({
			where: { tenantId: params.tenantId, periodoId: params.periodoId },
		}),
		db.ordenProduccion.count({
			where: {
				tenantId: params.tenantId,
				estado: 'COMPLETADA',
				fechaContabilizacion: null,
			},
		}),
	]);
	const entries = run ? await db.asiento.findMany({
		where: {
			tenantId: params.tenantId, periodoId: params.periodoId,
			OR: [{ estado: 'CONTABILIZADO' }, { estado: 'ANULADO', revertidoPorId: { not: null } }],
		},
		include: { lineas: true },
	}) : [];
	const actual = run?.preflight ? await snapshotPeriodo(
		db, params.tenantId, params.periodoId, params.contexto,
	) : null;

	return {
		asientosEnPeriodo,
		fuentesProduccionNoEvaluables,
		replay: run
			? {
				replayRunId: run.replayRunId,
				status: run.status,
				omittedCount: run.omittedCount,
				ambiguousCount: run.ambiguousCount,
				noFxCount: run.noFxCount,
				noCostCount: run.noCostCount,
				outOfPeriodCount: run.outOfPeriodCount,
				reconciliacion: leerReconciliacion(run.diagnostic),
				snapshotAcreditado: Boolean(run.preflight && verifySnapshotCoverage({
					tenantId: params.tenantId, periodoId: params.periodoId, replayRunId: run.replayRunId,
					snapshot: run.preflight.snapshot, digest: run.preflight.digest,
					digestVersion: run.preflight.digestVersion, entries,
				})),
				fuentesActualesAcreditadas: Boolean(run.preflight && actual &&
					verifyCurrentSources(run.preflight.snapshot, actual, run.preflight.digest)),
				manifiestoAcreditado: Boolean(run.preflight && isReplayManifestSnapshotComplete(
					(run.preflight.snapshot as { manifest?: unknown }).manifest,
				)),
			}
			: null,
	};
}
