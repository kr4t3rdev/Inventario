import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import type { EvidenciaCobertura, EvidenciaReplay } from './financial-ledger-coverage';

/** Parámetros de lectura de la evidencia de cobertura. */
export interface CoverageEvidenceParams {
	/** Tenant propietario del mayor formal. */
	tenantId: string;
	/** Período contable evaluado. */
	periodoId: string;
	/** Cliente transaccional opcional para leer en el mismo contexto. */
	client?: Prisma.TransactionClient;
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

	const db = params.client ?? prisma;
	const [run, asientosEnPeriodo] = await Promise.all([
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
			},
		}),
		db.asiento.count({
			where: { tenantId: params.tenantId, periodoId: params.periodoId },
		}),
	]);

	return {
		asientosEnPeriodo,
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
			}
			: null,
	};
}
