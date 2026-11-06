import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { evaluateCoverageEvidence } from './financial-ledger-coverage';
import { readCoverageEvidence } from './financial-ledger-coverage-reader';
import { verifyReversalIntegrity } from './financial-ledger-reversal-integrity';
import { resolveFormalAvailability } from './formal-financial-report-availability';
import type { FormalFinancialReportResolution } from './formal-financial-report-contract';
import { readFormalReportData } from './formal-financial-report-data';

/** Parámetros del reporte financiero formal. */
export interface FormalFinancialReportParams {
	/** Tenant propietario del mayor formal. */
	tenantId: string;
	/** Período contable evaluado. */
	periodoId: string;
	/** Fecha de corte inclusiva; por defecto, el cierre del período. */
	cutoffAt?: Date;
	/** Cliente transaccional opcional para leer en el mismo contexto. */
	client?: Prisma.TransactionClient;
}

/**
 * @description Resuelve el reporte financiero formal de un período.
 *
 * El reporte solo se publica con evidencia: cobertura global acreditada y
 * vínculos de reversión íntegros. Ante evidencia insuficiente queda no
 * disponible, sin recurrir a fuentes legacy ni a filas legacy.
 *
 * @param {FormalFinancialReportParams} params - Tenant, período y corte.
 * @returns {Promise<FormalFinancialReportResolution>} Reporte o causa de indisponibilidad.
 */
export async function getFormalFinancialReport(
	params: FormalFinancialReportParams,
): Promise<FormalFinancialReportResolution> {
	if (
		!params.tenantId.trim() ||
		!params.periodoId.trim() ||
		(params.cutoffAt !== undefined && !Number.isFinite(params.cutoffAt.getTime()))
	) {
		throw new Error('El tenant, el período y el corte son obligatorios');
	}

	const db = params.client ?? prisma;
	const periodo = await db.periodoContable.findFirst({
		where: { tenantId: params.tenantId, periodoId: params.periodoId },
		select: { periodoId: true, fechaInicio: true, fechaFin: true },
	});
	if (!periodo) {
		return {
			status: 'UNAVAILABLE',
			reason: 'PERIODO_NO_ENCONTRADO',
			periodoId: params.periodoId,
			coverage: null,
			problems: [],
		};
	}

	const coverage = evaluateCoverageEvidence(
		params.periodoId,
		await readCoverageEvidence({
			tenantId: params.tenantId,
			periodoId: params.periodoId,
			client: params.client,
		}),
	);
	const problems = await verifyReversalIntegrity({
		tenantId: params.tenantId,
		client: params.client,
	});

	const motivo = resolveFormalAvailability(coverage, problems);
	if (motivo) {
		return {
			status: 'UNAVAILABLE',
			reason: motivo,
			periodoId: params.periodoId,
			coverage,
			problems,
		};
	}

	const cutoffAt = params.cutoffAt ?? periodo.fechaFin;
	const datos = await readFormalReportData({
		tenantId: params.tenantId,
		from: periodo.fechaInicio,
		cutoffAt,
		client: params.client,
	});

	return {
		status: 'AVAILABLE',
		periodoId: params.periodoId,
		cutoffAt: cutoffAt.toISOString(),
		accounts: datos.accounts,
		result: datos.result,
		coverage,
	};
}
