import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { evaluateCoverageEvidence } from './financial-ledger-coverage';
import { readCoverageEvidence } from './financial-ledger-coverage-reader';
import { contextoSnapshotPeriodoLazy } from './replay-backfill-service';
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
	/** Cliente transaccional opcional, con aislamiento Repeatable Read o Serializable. */
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
	if (!params.client) {
		return prisma.$transaction(
			(client) => getFormalFinancialReport({ ...params, client }),
			// El reporte reconstruye la cobertura de todos los periodos previos:
			// el timeout por defecto de Prisma (5 s) abortaria la lectura con
			// P2028 en tenants con historia larga.
			{ isolationLevel: 'RepeatableRead', maxWait: 10_000, timeout: 120_000 },
		);
	}

	const db = params.client;
	// Las fuentes del tenant se reconstruyen una sola vez para todos los
	// periodos evaluados: el costo no se multiplica por el numero de periodos.
	const contexto = contextoSnapshotPeriodoLazy(db, params.tenantId);
	const [aislamiento] = await db.$queryRaw<Array<{ isolation: string }>>`
		SELECT current_setting('transaction_isolation') AS isolation
	`;
	if (!aislamiento || !['repeatable read', 'serializable'].includes(aislamiento.isolation)) {
		throw new Error('El reporte formal requiere aislamiento Repeatable Read o Serializable');
	}
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
			contexto,
		}),
	);
	const cutoffAt = params.cutoffAt ?? periodo.fechaFin;
	const periodosPreviosAlCorte = await db.periodoContable.findMany({
		where: {
			tenantId: params.tenantId, periodoId: { not: periodo.periodoId },
			fechaInicio: { lte: cutoffAt },
		},
		select: { periodoId: true, fechaInicio: true, fechaFin: true },
		orderBy: [{ fechaInicio: 'asc' }, { periodoId: 'asc' }],
	});
	let coberturaBalance = coverage;
	for (const anterior of periodosPreviosAlCorte) {
		const evidencia = await readCoverageEvidence({
			tenantId: params.tenantId, periodoId: anterior.periodoId, client: params.client,
			contexto,
		});
		const resultado = evaluateCoverageEvidence(anterior.periodoId, evidencia);
		if (resultado.estado !== 'CUBIERTA') {
			coberturaBalance = resultado;
			break;
		}
	}
	const periodos = [...periodosPreviosAlCorte, periodo].sort((a, b) =>
		a.fechaInicio.getTime() - b.fechaInicio.getTime() || a.periodoId.localeCompare(b.periodoId));
	const fechaDia = (fecha: Date) => Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
	const noContiguos = periodos.some((actual, index) => {
		if (actual.fechaFin < actual.fechaInicio) return true;
		if (index === 0) return false;
		return fechaDia(actual.fechaInicio) - fechaDia(periodos[index - 1].fechaFin) !== 86_400_000;
	});
	const corteInvalido = cutoffAt < periodo.fechaInicio || cutoffAt > periodo.fechaFin;
	const asientoFueraDePeriodo = await db.asiento.findFirst({
		where: {
			tenantId: params.tenantId,
			fecha: { lte: cutoffAt },
			AND: [
				{ OR: [{ estado: 'CONTABILIZADO' }, { estado: 'ANULADO', revertidoPorId: { not: null } }] },
				{ OR: [
					{ periodoId: { notIn: periodos.map((item) => item.periodoId) } },
					...periodos.map((item) => ({
						periodoId: item.periodoId,
						OR: [{ fecha: { lt: item.fechaInicio } }, { fecha: { gt: item.fechaFin } }],
					})),
				] },
			],
		},
		select: { asientoId: true },
	});
	const motivos = [
		...(noContiguos ? ['PERIODOS_NO_CONTIGUOS' as const] : []),
		...(corteInvalido ? ['CORTE_FUERA_DE_PERIODO' as const] : []),
		...(asientoFueraDePeriodo ? ['ASIENTOS_FUERA_DE_PERIODO' as const] : []),
	];
	if (motivos.length > 0) {
		coberturaBalance = {
			...coberturaBalance, estado: 'NO_CUBIERTA',
			motivos: [...coberturaBalance.motivos, ...motivos],
		};
	}
	const problems = await verifyReversalIntegrity({
		tenantId: params.tenantId,
		client: params.client,
	});

	const motivo = resolveFormalAvailability(coberturaBalance, problems);
	if (motivo) {
		return {
			status: 'UNAVAILABLE',
			reason: motivo,
			periodoId: params.periodoId,
			coverage: coberturaBalance,
			problems,
		};
	}

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
