import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { calcularLedgerHash, hashCanonical } from './formal-checkpoint-hash';
import type { FormalAccountBalance, FormalPeriodResult } from './formal-financial-report-contract';
import type { ResultadoCoberturaGlobal } from './financial-ledger-coverage';

/** Parámetros de lectura del checkpoint contable formal. */
export interface LeerCheckpointFormalParams {
	/** Tenant propietario del checkpoint. */
	tenantId: string;
	/** Período contable del checkpoint. */
	periodoId: string;
	/** Checkpoint específico; por defecto, el más reciente del período. */
	checkpointId?: string;
	/** Cliente transaccional opcional para leer en el mismo contexto. */
	client?: Prisma.TransactionClient;
}

/** Contenido persistido en el checkpoint formal. */
export interface PayloadCheckpointFormal {
	periodoId: string;
	cutoffAt: string;
	accounts: FormalAccountBalance[];
	result: FormalPeriodResult;
	coverage: ResultadoCoberturaGlobal;
}
/** Motivos por los que un checkpoint persistido no puede presentarse. */
export type MotivoCheckpointNoVerificado = 'PAYLOAD_ALTERADO' | 'LEDGER_ALTERADO';

/** Resultado de la lectura verificada del checkpoint formal. */
export type LecturaCheckpointFormal =
	| {
		status: 'VERIFICADO';
		checkpointId: string;
		periodoId: string;
		cutoffAt: string;
		ledgerHash: string;
		hashIntegridad: string;
		payload: PayloadCheckpointFormal;
	}
	| { status: 'NO_ENCONTRADO' }
	| {
		status: 'NO_VERIFICADO';
		motivo: MotivoCheckpointNoVerificado;
		checkpointId: string;
		periodoId: string;
	};

/**
 * @description Lee un checkpoint formal y verifica que siga siendo verificable.
 *
 * La verificación es doble: el payload debe conservar su hash de integridad y
 * el mayor formal debe producir el mismo hash de procedencia que tenía al
 * crearse. Si cualquiera falla, el checkpoint no se presenta como evidencia.
 *
 * @param {LeerCheckpointFormalParams} params - Tenant, período y checkpoint opcional.
 * @returns {Promise<LecturaCheckpointFormal>} Checkpoint verificado o el motivo del rechazo.
 */
export async function leerCheckpointFormal(
	params: LeerCheckpointFormalParams,
): Promise<LecturaCheckpointFormal> {
	if (!params.tenantId.trim() || !params.periodoId.trim()) {
		throw new Error('El tenant y el período son obligatorios para leer el checkpoint formal');
	}

	const db = params.client ?? prisma;
	const checkpoint = await db.checkpointContableFormal.findFirst({
		where: {
			tenantId: params.tenantId,
			periodoId: params.periodoId,
			...(params.checkpointId ? { checkpointId: params.checkpointId } : {}),
		},
		orderBy: [{ cutoffAt: 'desc' }, { createdAt: 'desc' }],
	});
	if (!checkpoint) return { status: 'NO_ENCONTRADO' };

	const payload = checkpoint.payload as unknown as PayloadCheckpointFormal;
	if (hashCanonical(payload) !== checkpoint.hashIntegridad) {
		return {
			status: 'NO_VERIFICADO',
			motivo: 'PAYLOAD_ALTERADO',
			checkpointId: checkpoint.checkpointId,
			periodoId: checkpoint.periodoId,
		};
	}

	const asientos = await db.asiento.findMany({
		where: { tenantId: params.tenantId, fecha: { lte: checkpoint.cutoffAt } },
		select: { asientoId: true, hash: true },
		orderBy: [{ tenantSequence: 'asc' }, { asientoId: 'asc' }],
	});
	if (calcularLedgerHash(asientos) !== checkpoint.ledgerHash) {
		return {
			status: 'NO_VERIFICADO',
			motivo: 'LEDGER_ALTERADO',
			checkpointId: checkpoint.checkpointId,
			periodoId: checkpoint.periodoId,
		};
	}

	return {
		status: 'VERIFICADO',
		checkpointId: checkpoint.checkpointId,
		periodoId: checkpoint.periodoId,
		cutoffAt: checkpoint.cutoffAt.toISOString(),
		ledgerHash: checkpoint.ledgerHash,
		hashIntegridad: checkpoint.hashIntegridad,
		payload,
	};
}
