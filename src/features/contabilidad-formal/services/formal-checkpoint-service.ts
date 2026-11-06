import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { calcularLedgerHash, hashCanonical } from './formal-checkpoint-hash';
import { getFormalFinancialReport } from './formal-financial-report-service';

/** Parámetros de creación del checkpoint contable formal. */
export interface CrearCheckpointFormalParams {
	/** Tenant propietario del checkpoint. */
	tenantId: string;
	/** Período contable del reporte. */
	periodoId: string;
	/** Corte inclusivo; por defecto, el cierre del período. */
	cutoffAt?: Date;
	/** Usuario que registra el checkpoint. */
	createdBy?: string;
	/** Cliente transaccional opcional para leer y persistir en el mismo contexto. */
	client?: Prisma.TransactionClient;
}

/** Checkpoint contable formal persistido. */
export interface CheckpointFormalRegistrado {
	/** Identificador del checkpoint. */
	checkpointId: string;
	/** Período contable del checkpoint. */
	periodoId: string;
	/** Corte inclusivo aplicado. */
	cutoffAt: string;
	/** Hash de procedencia del mayor formal. */
	ledgerHash: string;
	/** Hash de integridad del payload persistido. */
	hashIntegridad: string;
	/** Ejecución de replay que acreditó la cobertura. */
	replayRunId: string | null;
}

/**
 * @description Registra un checkpoint contable formal con procedencia en el mayor.
 *
 * El checkpoint solo se crea si el reporte formal está disponible: un
 * período sin cobertura acreditada no produce evidencia. El hash de
 * procedencia resume la cadena de asientos del tenant hasta el corte, de modo
 * que cualquier cambio posterior en ese ledger invalida el checkpoint.
 *
 * @param {CrearCheckpointFormalParams} params - Tenant, período, corte y autor.
 * @returns {Promise<CheckpointFormalRegistrado>} Checkpoint persistido.
 */
export async function crearCheckpointFormal(
	params: CrearCheckpointFormalParams,
): Promise<CheckpointFormalRegistrado> {
	if (!params.tenantId.trim() || !params.periodoId.trim()) {
		throw new Error('El tenant y el período son obligatorios para crear el checkpoint formal');
	}

	const db = params.client ?? prisma;
	const reporte = await getFormalFinancialReport({
		tenantId: params.tenantId,
		periodoId: params.periodoId,
		cutoffAt: params.cutoffAt,
		client: params.client,
	});
	if (reporte.status !== 'AVAILABLE') {
		throw new Error(
			`El checkpoint formal requiere cobertura acreditada: el reporte no está disponible (${reporte.reason})`,
		);
	}

	const cutoffAt = new Date(reporte.cutoffAt);
	const asientos = await db.asiento.findMany({
		where: { tenantId: params.tenantId, fecha: { lte: cutoffAt } },
		select: { asientoId: true, hash: true },
		orderBy: [{ tenantSequence: 'asc' }, { asientoId: 'asc' }],
	});
	const ledgerHash = calcularLedgerHash(asientos);

	const payload = {
		periodoId: reporte.periodoId,
		cutoffAt: reporte.cutoffAt,
		accounts: reporte.accounts,
		result: reporte.result,
		coverage: reporte.coverage,
	};
	const hashIntegridad = hashCanonical(payload);

	const creado = await db.checkpointContableFormal.create({
		data: {
			tenantId: params.tenantId,
			periodoId: reporte.periodoId,
			cutoffAt,
			ledgerHash,
			replayRunId: reporte.coverage.replayRunId,
			payload: payload as unknown as Prisma.InputJsonValue,
			hashIntegridad,
			createdBy: params.createdBy ?? null,
		},
		select: { checkpointId: true },
	});

	return {
		checkpointId: creado.checkpointId,
		periodoId: reporte.periodoId,
		cutoffAt: reporte.cutoffAt,
		ledgerHash,
		hashIntegridad,
		replayRunId: reporte.coverage.replayRunId,
	};
}
