/**
 * @description Orquestador del replay historico de la contabilidad formal (S7).
 *
 * El replay vuelve a contabilizar en el libro formal las operaciones
 * historicas de un periodo que quedaron sin asiento porque la capa estaba
 * apagada. No es una carga masiva: es un proceso gobernado por tres pasos que
 * no pueden Happens sin el otro:
 *
 *  1. **Preflight**: se construye un snapshot canonico de las fuentes del
 *     periodo y se persiste su digest. El snapshot congela la valoracion
 *     funcional de cada fuente, no una nueva estimacion.
 *  2. **Aprobacion independiente**: otro responsable activo aprueba ese
 *     digest. Si las fuentes cambiaron entre el preflight y la aprobacion, la
 *     aprobacion se rechaza.
 *  3. **Ejecucion**: se contabiliza exactamente el periodo aprobado y se
 *     verifica el resultado contra el snapshot con el verificador forense.
 *
 * El alcance del recolector es deliberado: cubre el reconocimiento de ventas
 * de productos (venta a credito, venta al contado y cobro de la cuenta por
 * cobrar). Las demas fuentes operativas todavia no tienen contraparte formal
 * en el flujo vigente, de modo que no se inventan asientos que el writer
 * operativo no habria emitido.
 *
 * @module src/features/contabilidad-formal/services/replay-backfill-service
 */
import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import {
	replayEvento,
	type EventoContableInput,
} from './posting-engine';
import { reconcileReplaySnapshot } from './replay-reconciliation';
import { resolverValuacionOperativa } from '../lib/functional-valuation-resolver';
import { construirEventoLiquidacion } from './settlement-posting-service';
import { derivarMedioCobro } from '../lib/settlement-event-builder';
import {
	computeReplayPreflightDigest,
	REPLAY_PREFLIGHT_DIGEST_VERSION,
	type ReplayPreflightDigestSnapshot,
	type ReplayPreflightSourceSnapshot,
} from './replay-preflight-digest';
import {
	requireCurrentReplayPermission,
	requireCurrentReplayEntitlement,
	withReplayPostingCapability,
} from './replay-posting-capability';

/** Version del digest de preflight persistida en la fila de evidencia. */
const REPLAY_DIGEST_VERSION = 2;

/** Ventana de aprobacion del preflight: 24 horas. */
const REPLAY_TTL_MS = 24 * 60 * 60 * 1000;

/** Intentos maximos ante fallos de serializacion o bloqueo. */
const REPLAY_TRANSACTION_MAX_ATTEMPTS = 3;

/** Origen del reconocimiento de venta a credito: la factura. */
const VENTA_CREDITO_ORIGIN_TYPE = 'factura';

/** Origen del reconocimiento de venta al contado y del cobro: la conciliacion. */
const RECONCILIACION_VENTA_ORIGIN_TYPE = 'reconciliacion_venta';

/** Cliente Prisma que sirve tanto para lectura como para transaccion. */
export type ReplayDb = typeof prisma | Prisma.TransactionClient;

/** Candidato reconstruido con el evento formal listo para contabilizar. */
export interface CandidatoReplay {
	/** Tipo de origen del evento formal. */
	origenTipo: string;
	/** Identificador del documento que origina el evento. */
	origenId: string;
	/** Fecha de negocio del evento. */
	fecha: Date;
	/** Evento formal reconstruido. */
	evento: EventoContableInput;
	/** Causa de omision, cuando la fuente no puede contabilizarse. */
	causaOmision?: string;
}

/** Periodo contable con su conteo de fuentes. */
export interface PeriodoBackfill {
	periodoId: string;
	codigo: string;
	fechaInicio: Date;
	fechaFin: Date;
	replayables: number;
	yaPosteados: number;
}

/** Resultado del dry-run por tenant. */
export interface PlanBackfill {
	periodos: PeriodoBackfill[];
	totalEvaluados: number;
	yaPosteados: number;
	sinPeriodo: number;
	omitidos: Array<{ origenTipo: string; origenId: string; causa: string }>;
}

/** Resultado de la ejecucion de un periodo. */
export interface ResultadoBackfillPeriodo {
	contabilizados: number;
	yaPosteados: number;
	omitidos: number;
}

/** Fila de preflight persistida, con el snapshot ya validado. */
type PreflightRecord = {
	replayPreflightId: string;
	tenantId: string;
	periodoId: string;
	requestedByUserId: string;
	generatedAt: Date;
	expiresAt: Date;
	digestVersion: number;
	digest: string;
	snapshot: unknown;
	status: string;
};

/**
 * @description Reintenta solo los fallos de serializacion o bloqueo; nunca un
 * error de negocio.
 * @param {unknown} error - Error capturado de la transaccion.
 * @returns {boolean} True si la transaccion puede reintentarse.
 */
function isRetryableReplayTransactionError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;
	const candidate = error as { code?: unknown; meta?: { code?: unknown; cause?: unknown } };
	return (
		candidate.code === 'P2034' ||
		candidate.code === '40001' ||
		candidate.code === '40P01' ||
		candidate.meta?.code === '40001' ||
		candidate.meta?.code === '40P01' ||
		candidate.meta?.cause === '40001' ||
		candidate.meta?.cause === '40P01'
	);
}

/**
 * @description Serializa un decimal de origen sin perder precision ni usar
 * notacion exponencial.
 * @param {unknown} value - Decimal de Prisma, texto o numero.
 * @returns {Prisma.Decimal | null} Decimal finito o null si no es utilizable.
 */
function decimalOrigen(value: unknown): Prisma.Decimal | null {
	if (value === null || value === undefined || value === '') return null;
	try {
		if (
			typeof value !== 'string' &&
			typeof value !== 'number' &&
			!(value instanceof Prisma.Decimal)
		) {
			return null;
		}
		const decimal = new Prisma.Decimal(String(value));
		return decimal.isFinite() ? decimal : null;
	} catch {
		return null;
	}
}

/**
 * @description Reconstruye los candidatos a replay de un tenant leyendo las
 * fuentes operativas historicas y derivando el evento formal equivalente al
 * que emite el writer vigente.
 *
 * Reglas de clasificacion (conservadoras: ante duda la fuente se omite):
 *
 *  - La factura de una venta a plazo (con cuenta por cobrar) genera
 *    `VENTA_CREDITO`, valorado con la tasa publicada vigente en su fecha de
 *    emision.
 *  - La conciliacion de una venta a plazo liquida esa cuenta por cobrar:
 *    genera `COBRO_CXC` con la valoracion ya persistida.
 *  - La conciliacion de una venta cobrada al contado genera `VENTA_CONTADO`
 *    con la valoracion ya persistida; si la venta tiene mas de una
 *    conciliacion, la fuente se omite por identidad ambigua.
 *
 * @param {string} tenantId - Tenant propietario de las fuentes.
 * @param {ReplayDb} client - Cliente Prisma de lectura.
 * @returns {Promise<CandidatoReplay[]>} Candidatos con su fecha de negocio.
 */
export async function recolectarCandidatos(
	tenantId: string,
	client: ReplayDb = prisma,
): Promise<CandidatoReplay[]> {
	const [reconciliaciones, facturas, cuentasPorCobrar, cuentasBancarias] = await Promise.all([
		client.reconciliacionVenta.findMany({
			where: { tenantId },
			select: {
				reconciliacionId: true,
				ventaId: true,
				cuentaId: true,
				monto: true,
				moneda: true,
				montoConvertido: true,
				functionalCurrency: true,
				tasaCambio: true,
				fxEvidenceFingerprint: true,
				fechaReconciliacion: true,
				observaciones: true,
				idTransferencia: true,
				venta: {
					select: {
						ventaId: true,
						deletedAt: true,
						factura: { select: { idFactura: true } },
					},
				},
			},
		}),
		client.factura.findMany({
			where: { tenantId, tipoDocumento: 'FACTURA' },
			select: {
				idFactura: true,
				ventaId: true,
				total: true,
				estado: true,
				fechaEmision: true,
			},
		}),
		client.cuentaPorCobrar.findMany({
			where: { tenantId },
			select: {
				id: true,
				facturaId: true,
				estado: true,
			},
		}),
		client.cuentaBancaria.findMany({
			where: { tenantId },
			select: { cuentaId: true, tipoCuenta: true },
		}),
	]);

	const tipoCuentaPorCuenta = new Map(
		cuentasBancarias.map((cuenta) => [cuenta.cuentaId, cuenta.tipoCuenta]),
	);
	const cxPorFactura = new Map(
		cuentasPorCobrar
			.filter((cuenta) => cuenta.facturaId !== null)
			.map((cuenta) => [cuenta.facturaId as string, cuenta]),
	);

	/**
	 * @description Resuelve la cuenta por cobrar de una factura.
	 * @param {string | null} facturaId - Identificador de la factura.
	 * @returns {object | undefined} Cuenta por cobrar vigente de la factura.
	 */
	const cuentaPorCobrarDe = (
		facturaId: string | null,
	): { id: string; facturaId: string | null; estado: string } | undefined =>
		facturaId ? cxPorFactura.get(facturaId) : undefined;

	const reconciliacionesPorVenta = new Map<string, typeof reconciliaciones>();
	for (const reconciliacion of reconciliaciones) {
		if (!reconciliacion.ventaId) continue;
		const lista = reconciliacionesPorVenta.get(reconciliacion.ventaId) ?? [];
		lista.push(reconciliacion);
		reconciliacionesPorVenta.set(reconciliacion.ventaId, lista);
	}

	const candidatos: CandidatoReplay[] = [];

	for (const reconciliacion of reconciliaciones) {
		const venta = reconciliacion.venta;
		if (!reconciliacion.ventaId || !venta) continue;
		// Las ventas directas (sin factura) no tienen contraparte formal en el
		// flujo vigente: no se inventa un asiento que el writer no emitio.
		const facturaId = venta.factura?.idFactura ?? null;
		if (!facturaId) continue;

		const cuentaPorCobrar = cuentaPorCobrarDe(facturaId);
		const esVentaAPlazo = Boolean(cuentaPorCobrar) && cuentaPorCobrar?.estado !== 'ANULADA';
		const tipoCuenta = tipoCuentaPorCuenta.get(reconciliacion.cuentaId) ?? null;
		const omision = venta.deletedAt
			? 'VENTA_ANULADA'
			: reconciliacion.venta && reconciliacionesPorVenta.get(reconciliacion.ventaId)!.length > 1 && !esVentaAPlazo
				? 'IDENTIDAD_AMBIGUA'
				: undefined;

		let evento: EventoContableInput;
		if (esVentaAPlazo) {
			const liquidacion = await construirEventoLiquidacion(
				client as Prisma.TransactionClient,
				{ tenantId, userId: 'replay-preflight' },
				{
					tipo: 'COBRO_CXC',
					reconciliacion: {
						reconciliacionId: reconciliacion.reconciliacionId,
						monto: reconciliacion.monto,
						moneda: reconciliacion.moneda,
						montoConvertido: reconciliacion.montoConvertido,
						functionalCurrency: reconciliacion.functionalCurrency,
						tasaCambio: reconciliacion.tasaCambio,
						fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint,
						fechaReconciliacion: reconciliacion.fechaReconciliacion,
					},
					treasuryAccountType: tipoCuenta,
					descripcion: reconciliacion.observaciones ?? 'Cobro de venta',
				},
			);
			evento = liquidacion;
		} else {
			evento = {
				tipo: 'VENTA_CONTADO',
				fecha: reconciliacion.fechaReconciliacion,
				descripcion: reconciliacion.observaciones ?? 'Cobro total por contra pago',
				origen: {
					tipo: RECONCILIACION_VENTA_ORIGIN_TYPE,
					id: reconciliacion.reconciliacionId,
				},
				monto: reconciliacion.monto,
				moneda: reconciliacion.moneda,
				montoFuncional: reconciliacion.montoConvertido,
				monedaFuncional: reconciliacion.functionalCurrency,
				tasaCambio: reconciliacion.tasaCambio,
				fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint,
				medioCobro: derivarMedioCobro(tipoCuenta),
				...(reconciliacion.idTransferencia
					? { referencia: reconciliacion.idTransferencia }
					: {}),
			};
		}

		candidatos.push({
			origenTipo: evento.origen.tipo,
			origenId: evento.origen.id,
			fecha: evento.fecha,
			evento,
			...(omision ? { causaOmision: omision } : {}),
		});
	}

	for (const factura of facturas) {
		if (!factura.ventaId) continue;
		const cuentaPorCobrar = cuentaPorCobrarDe(factura.idFactura);
		// Sin cuenta por cobrar la venta se cobro al contado: su reconocimiento
		// es el evento del cobro, no uno de la factura.
		if (!cuentaPorCobrar || cuentaPorCobrar.estado === 'ANULADA') continue;

		const monto = Math.abs(Number(factura.total));
		const valoracion = await resolverValuacionOperativa({
			tx: client as Prisma.TransactionClient,
			tenantId,
			monto,
			moneda: 'CUP',
			fechaOperacion: factura.fechaEmision,
			source: 'replay-backfill-service',
		});
		const omision = factura.estado === 'ANULADA' ? 'FACTURA_ANULADA' : undefined;
		candidatos.push({
			origenTipo: VENTA_CREDITO_ORIGIN_TYPE,
			origenId: factura.idFactura,
			fecha: factura.fechaEmision,
			evento: {
				tipo: 'VENTA_CREDITO',
				fecha: factura.fechaEmision,
				descripcion: `Venta a credito ${factura.idFactura}`,
				origen: { tipo: VENTA_CREDITO_ORIGIN_TYPE, id: factura.idFactura },
				monto,
				moneda: 'CUP',
				montoFuncional: valoracion.montoFuncional,
				monedaFuncional: valoracion.monedaFuncional,
				tasaCambio: valoracion.tasaCambio,
				fxEvidenceFingerprint: valoracion.fxEvidenceFingerprint,
			},
			...(omision ? { causaOmision: omision } : {}),
		});
	}

	candidatos.sort((left, right) => {
		const porFecha = left.fecha.getTime() - right.fecha.getTime();
		if (porFecha !== 0) return porFecha;
		if (left.origenTipo !== right.origenTipo) {
			return left.origenTipo < right.origenTipo ? -1 : 1;
		}
		return left.origenId < right.origenId ? -1 : left.origenId > right.origenId ? 1 : 0;
	});
	return candidatos;
}

/**
 * @description Resuelve que periodo contable contiene la fecha.
 * @param {Array<{ periodoId: string; fechaInicio: Date; fechaFin: Date }>} periodos - Periodos del tenant.
 * @param {Date} fecha - Fecha de negocio.
 * @returns {string | null} Identificador del periodo o null si no hay ninguno.
 */
function encuentraPeriodoId(
	periodos: Array<{ periodoId: string; fechaInicio: Date; fechaFin: Date }>,
	fecha: Date,
): string | null {
	for (const periodo of periodos) {
		if (fecha >= periodo.fechaInicio && fecha <= periodo.fechaFin) return periodo.periodoId;
	}
	return null;
}

/**
 * @description Construye el plan de replay por periodos sin escribir nada.
 * @param {string} tenantId - Tenant consultado.
 * @returns {Promise<PlanBackfill>} Conteo de fuentes por periodo y omisiones.
 */
export async function planBackfillContable(tenantId: string): Promise<PlanBackfill> {
	await requireCurrentReplayEntitlement(prisma, tenantId);
	const [periodosRows, asientosExistentes, candidatos] = await Promise.all([
		prisma.periodoContable.findMany({
			where: { tenantId },
			select: { periodoId: true, fechaInicio: true, fechaFin: true },
			orderBy: { fechaInicio: 'asc' },
		}),
		prisma.asiento.findMany({
			where: { tenantId },
			select: { origenTipo: true, origenId: true },
		}),
		recolectarCandidatos(tenantId),
	]);

	const posteados = new Set(
		asientosExistentes.map((asiento) => `${asiento.origenTipo}:${asiento.origenId}`),
	);
	const periodos: PeriodoBackfill[] = periodosRows.map((periodo) => ({
		periodoId: periodo.periodoId,
		codigo: periodo.periodoId,
		fechaInicio: periodo.fechaInicio,
		fechaFin: periodo.fechaFin,
		replayables: 0,
		yaPosteados: 0,
	}));

	let sinPeriodo = 0;
	let yaPosteadosTotal = 0;
	const omitidos: PlanBackfill['omitidos'] = [];
	const periodoPorId = new Map(periodos.map((periodo) => [periodo.periodoId, periodo]));

	for (const candidato of candidatos) {
		if (candidato.causaOmision === 'IDENTIDAD_AMBIGUA') {
			omitidos.push({
				origenTipo: candidato.origenTipo,
				origenId: candidato.origenId,
				causa: candidato.causaOmision,
			});
			continue;
		}
		if (posteados.has(`${candidato.origenTipo}:${candidato.origenId}`)) {
			yaPosteadosTotal += 1;
			const periodo = periodoPorId.get(encuentraPeriodoId(periodosRows, candidato.fecha) ?? '');
			if (periodo) periodo.yaPosteados += 1;
			continue;
		}
		const periodoEnc = encuentraPeriodoId(periodosRows, candidato.fecha);
		if (!periodoEnc) {
			sinPeriodo += 1;
			omitidos.push({
				origenTipo: candidato.origenTipo,
				origenId: candidato.origenId,
				causa: 'FUERA_DE_PERIODO',
			});
			continue;
		}
		if (candidato.causaOmision) {
			omitidos.push({
				origenTipo: candidato.origenTipo,
				origenId: candidato.origenId,
				causa: candidato.causaOmision,
			});
			continue;
		}
		const periodo = periodoPorId.get(periodoEnc);
		if (periodo) periodo.replayables += 1;
	}

	return {
		periodos,
		totalEvaluados: candidatos.length,
		yaPosteados: yaPosteadosTotal,
		sinPeriodo,
		omitidos,
	};
}

/**
 * @description Produce una fila canonica por identidad de fuente para el digest.
 * @param {ReplayDb} client - Cliente Prisma de lectura.
 * @param {string} tenantId - Tenant del periodo.
 * @param {string} periodoId - Periodo contable a reconstruir.
 * @returns {Promise<ReplayPreflightDigestSnapshot>} Snapshot canonico del periodo.
 */
async function snapshotPeriodo(
	client: ReplayDb,
	tenantId: string,
	periodoId: string,
): Promise<ReplayPreflightDigestSnapshot> {
	const periodo = await client.periodoContable.findFirst({
		where: { tenantId, periodoId },
		select: { periodoId: true, fechaInicio: true, fechaFin: true },
	});
	if (!periodo) throw new Error('Período contable no encontrado para el tenant');

	const [candidatos, asientos] = await Promise.all([
		recolectarCandidatos(tenantId, client),
		client.asiento.findMany({
			where: { tenantId },
			select: { origenTipo: true, origenId: true },
		}),
	]);
	const posteados = new Set(
		asientos.map((asiento) => `${asiento.origenTipo}:${asiento.origenId}`),
	);
	const grupos = new Map<string, CandidatoReplay[]>();
	for (const candidato of candidatos) {
		if (candidato.fecha < periodo.fechaInicio || candidato.fecha > periodo.fechaFin) continue;
		const clave = `${candidato.origenTipo}:${candidato.origenId}`;
		grupos.set(clave, [...(grupos.get(clave) ?? []), candidato]);
	}

	const sources: ReplayPreflightSourceSnapshot[] = [];
	for (const [clave, grupo] of grupos) {
		const candidato = grupo[0];
		const cause = grupo.length > 1 ? 'IDENTIDAD_AMBIGUA' : candidato.causaOmision ?? null;
		const alreadyPosted = posteados.has(clave);
		const omitted = cause === 'IDENTIDAD_AMBIGUA' || (!alreadyPosted && cause !== null);
		const originalAmount = decimalOrigen(candidato.evento.monto);
		const functionalAmount = decimalOrigen(candidato.evento.montoFuncional);
		const rate = decimalOrigen(candidato.evento.tasaCambio);
		const auxiliares = candidato.evento.auxiliares;
		sources.push({
			identity: { sourceType: candidato.origenTipo, sourceId: candidato.origenId },
			classification: omitted ? 'OMITIDO' : alreadyPosted ? 'YA_POSTEADO' : 'REPLAYABLE',
			omissionCause: omitted ? cause : null,
			semantics: {
				tipo: candidato.evento.tipo,
				fecha: candidato.evento.fecha,
				descripcion: candidato.evento.descripcion,
				medioCobro: candidato.evento.medioCobro ?? null,
				referencia: candidato.evento.referencia ?? null,
				auxiliares: {
					costoFifo: decimalOrigen(auxiliares?.costoFifo)?.toString() ?? null,
					intereses: decimalOrigen(auxiliares?.intereses)?.toString() ?? null,
					montoPagado: decimalOrigen(auxiliares?.montoPagado)?.toString() ?? null,
					diferenciaFx: decimalOrigen(auxiliares?.diferenciaFx)?.toString() ?? null,
				},
			},
			valuation: {
				originalAmount: originalAmount?.isFinite() ? originalAmount.toString() : null,
				originalCurrency: candidato.evento.moneda?.trim().toUpperCase() || null,
				functionalAmount: functionalAmount?.isFinite() ? functionalAmount.toString() : null,
				functionalCurrency: candidato.evento.monedaFuncional?.trim().toUpperCase() || null,
				fxRate: rate?.isFinite() ? rate.toString() : null,
				fxEvidenceFingerprint: candidato.evento.fxEvidenceFingerprint ?? null,
			},
		});
	}

	sources.sort((left, right) => {
		if (left.identity.sourceType !== right.identity.sourceType) {
			return left.identity.sourceType < right.identity.sourceType ? -1 : 1;
		}
		return left.identity.sourceId < right.identity.sourceId ? -1 : 1;
	});

	return {
		tenantId,
		period: {
			periodId: periodo.periodoId,
			startsAt: periodo.fechaInicio,
			endsAt: periodo.fechaFin,
		},
		sources,
	};
}

/**
 * @description Valida que el preflight exista, no haya vencido y su digest sea
 * coherente con el snapshot persistido.
 * @param {PreflightRecord} preflight - Preflight leido de la base.
 * @param {string} tenantId - Tenant esperado.
 * @param {Date} now - Momento de evaluacion.
 * @param {string[]} allowedStatuses - Estados admitidos en este paso.
 * @returns {ReplayPreflightDigestSnapshot} Snapshot canonico validado.
 */
function validarPreflight(
	preflight: PreflightRecord,
	tenantId: string,
	now = new Date(),
	allowedStatuses: string[] = ['READY'],
): ReplayPreflightDigestSnapshot {
	if (
		preflight.tenantId !== tenantId ||
		!allowedStatuses.includes(preflight.status) ||
		preflight.digestVersion !== REPLAY_DIGEST_VERSION ||
		preflight.expiresAt.getTime() !== preflight.generatedAt.getTime() + REPLAY_TTL_MS ||
		preflight.expiresAt <= now
	) {
		throw new Error('Preflight inexistente, vencido o no vigente');
	}
	const snapshot = preflight.snapshot as ReplayPreflightDigestSnapshot;
	if (
		snapshot.tenantId !== tenantId ||
		snapshot.period.periodId !== preflight.periodoId ||
		computeReplayPreflightDigest(snapshot, REPLAY_PREFLIGHT_DIGEST_VERSION) !== preflight.digest
	) {
		throw new Error('Digest de preflight inconsistente');
	}
	return snapshot;
}

/**
 * @description Persiste el snapshot canonico y la ventana de aprobacion de 24h.
 * @param {string} tenantId - Tenant del periodo.
 * @param {string} periodoId - Periodo contable a reconstruir.
 * @param {string} requesterId - Responsable que solicita el preflight.
 * @returns {Promise<object>} Preflight persistido.
 */
export async function crearPreflightBackfill(
	tenantId: string,
	periodoId: string,
	requesterId: string,
) {
	await requireCurrentReplayEntitlement(prisma, tenantId);
	return prisma.$transaction(
		async (tx) => {
			await requireCurrentReplayEntitlement(tx, tenantId);
			await lockPeriodo(tx, tenantId, periodoId);
			await requireCurrentReplayPermission(tx, tenantId, requesterId, false);
			const snapshot = await snapshotPeriodo(tx, tenantId, periodoId);
			const generatedAt = new Date();
			return tx.replayPreflight.create({
				data: {
					tenantId,
					periodoId,
					requestedByUserId: requesterId,
					generatedAt,
					expiresAt: new Date(generatedAt.getTime() + REPLAY_TTL_MS),
					digestVersion: REPLAY_DIGEST_VERSION,
					digest: computeReplayPreflightDigest(snapshot, REPLAY_PREFLIGHT_DIGEST_VERSION),
					snapshot: snapshot as unknown as Prisma.InputJsonValue,
					status: 'READY',
				},
			});
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);
}

/**
 * @description Crea la aprobacion inmutable de un preflight por otro
 * responsable activo. Si las fuentes cambiaron, la aprobacion se rechaza.
 * @param {string} tenantId - Tenant del preflight.
 * @param {string} replayPreflightId - Preflight a aprobar.
 * @param {string} approverId - Responsable que aprueba (distinto del solicitante).
 * @returns {Promise<object>} Aprobacion persistida.
 */
export async function aprobarPreflightBackfill(
	tenantId: string,
	replayPreflightId: string,
	approverId: string,
) {
	await requireCurrentReplayEntitlement(prisma, tenantId);
	return prisma.$transaction(async (tx) => {
		await requireCurrentReplayEntitlement(tx, tenantId);
		const preflight = (await tx.replayPreflight.findFirst({
			where: { tenantId, replayPreflightId },
		})) as PreflightRecord | null;
		if (!preflight) throw new Error('Preflight no encontrado');
		await lockPeriodo(tx, tenantId, preflight.periodoId);
		const snapshot = validarPreflight(preflight, tenantId);
		if (approverId === preflight.requestedByUserId) {
			throw new Error('La aprobación debe ser independiente');
		}
		await requireCurrentReplayPermission(tx, tenantId, approverId);
		const currentSnapshot = await snapshotPeriodo(tx, tenantId, preflight.periodoId);
		if (
			computeReplayPreflightDigest(currentSnapshot, REPLAY_PREFLIGHT_DIGEST_VERSION) !== preflight.digest
		) {
			throw new Error('Las fuentes cambiaron antes de aprobar el preflight');
		}
		const approval = await tx.replayApproval.create({
			data: {
				tenantId,
				replayPreflightId,
				requestedByUserId: preflight.requestedByUserId,
				approvedByUserId: approverId,
				digestVersion: preflight.digestVersion,
				digest: computeReplayPreflightDigest(snapshot, REPLAY_PREFLIGHT_DIGEST_VERSION),
				status: 'APPROVED',
			},
		});
		await tx.replayPreflight.update({
			where: { replayPreflightId },
			data: { status: 'APPROVED' },
		});
		return approval;
	});
}

/**
 * @description Datos de la ejecucion autorizada de un replay.
 */
export interface EjecutarBackfillAutorizadoInput {
	tenantId: string;
	replayPreflightId: string;
	replayApprovalId: string;
	actorId: string;
}

/**
 * @description Ejecuta exactamente un periodo aprobado y registra el resultado
 * en una sola transaccion: contabiliza, verifica y persiste el diagnostico.
 * @param {EjecutarBackfillAutorizadoInput} input - Preflight, aprobacion y actor.
 * @returns {Promise<object>} Resultado de la ejecucion con el verificador forense.
 */
export async function ejecutarBackfillAutorizado(input: EjecutarBackfillAutorizadoInput) {
	const { tenantId, replayPreflightId, replayApprovalId, actorId } = input;
	await requireCurrentReplayEntitlement(prisma, tenantId);

	const executeAttempt = () =>
		prisma.$transaction(
			async (tx) => {
				await requireCurrentReplayEntitlement(tx, tenantId);
				const preflight = (await tx.replayPreflight.findFirst({
					where: { tenantId, replayPreflightId },
				})) as PreflightRecord | null;
				if (!preflight) throw new Error('Preflight no encontrado');
				await lockPeriodo(tx, tenantId, preflight.periodoId);
				validarPreflight(preflight, tenantId, new Date(), ['APPROVED']);
				await requireCurrentReplayPermission(tx, tenantId, actorId);
				const approval = await tx.replayApproval.findFirst({
					where: { tenantId, replayPreflightId, replayApprovalId, status: 'APPROVED' },
				});
				if (
					!approval ||
					approval.requestedByUserId !== preflight.requestedByUserId ||
					approval.approvedByUserId === preflight.requestedByUserId ||
					approval.digestVersion !== preflight.digestVersion ||
					approval.digest !== preflight.digest
				) {
					throw new Error('Aprobación no válida para este preflight');
				}
				await requireCurrentReplayPermission(tx, tenantId, approval.approvedByUserId);

				const current = await snapshotPeriodo(tx, tenantId, preflight.periodoId);
				if (
					computeReplayPreflightDigest(current, REPLAY_PREFLIGHT_DIGEST_VERSION) !== preflight.digest
				) {
					throw new Error('Las fuentes cambiaron desde el preflight; genera uno nuevo');
				}

				const activeRun = await tx.replayRun.findFirst({
					where: { tenantId, status: 'RUNNING', preflight: { periodoId: preflight.periodoId } },
				});
				if (activeRun) throw new Error('Ya existe una ejecución activa para este preflight');

				const periodGuardBypass = {
					capability: 'AUTHORIZED_HISTORICAL_REPLAY',
					authorityVersion: 'r55-runtime-v1',
					mechanism: 'replayEvento',
					tenantId,
					periodoId: preflight.periodoId,
					replayPreflightId,
					replayApprovalId,
					actorId,
					digest: preflight.digest,
				};
				const run = await tx.replayRun.create({
					data: {
						tenantId,
						replayPreflightId,
						replayApprovalId,
						startedByUserId: actorId,
						digestVersion: preflight.digestVersion,
						digest: preflight.digest,
						status: 'RUNNING',
						sourceCount: current.sources.length,
						diagnostic: { periodGuardBypass } as Prisma.InputJsonValue,
					},
				});

				// La ejecucion y las escrituras contables comparten la transaccion
				// externa: el savepoint permite deshacer las contabilizaciones y
				// conservar el resultado FAILED.
				await tx.$executeRawUnsafe('SAVEPOINT replay_period_postings');
				try {
					const [periodo, candidatos, existentes, snapshot] = await Promise.all([
						tx.periodoContable.findFirst({
							where: { tenantId, periodoId: preflight.periodoId },
							select: { periodoId: true, fechaInicio: true, fechaFin: true },
						}),
						recolectarCandidatos(tenantId, tx),
						tx.asiento.findMany({
							where: { tenantId },
							select: { origenTipo: true, origenId: true },
						}),
						snapshotPeriodo(tx, tenantId, preflight.periodoId),
					]);
					if (
						!periodo ||
						computeReplayPreflightDigest(snapshot, REPLAY_PREFLIGHT_DIGEST_VERSION) !== preflight.digest
					) {
						throw new Error('El período o las fuentes cambiaron antes de contabilizar');
					}
					const posteados = new Set(
						existentes.map((asiento) => `${asiento.origenTipo}:${asiento.origenId}`),
					);
					const delPeriodo = candidatos.filter(
						(candidato) =>
							candidato.fecha >= periodo.fechaInicio && candidato.fecha <= periodo.fechaFin,
					);

					let postedCount = 0;
					let alreadyPostedCount = 0;
					let omittedCount = 0;
					const diagnostics: Array<{ sourceType: string; sourceId: string; cause: string }> = [];

					await withReplayPostingCapability(
						tx,
						{
							tenantId,
							userId: actorId,
							periodoId: periodo.periodoId,
							replayRunId: run.replayRunId,
						},
						async (capability) => {
							for (const candidato of delPeriodo) {
								if (candidato.causaOmision === 'IDENTIDAD_AMBIGUA') {
									omittedCount += 1;
									diagnostics.push({
										sourceType: candidato.origenTipo,
										sourceId: candidato.origenId,
										cause: candidato.causaOmision,
									});
									continue;
								}
								if (posteados.has(`${candidato.origenTipo}:${candidato.origenId}`)) {
									alreadyPostedCount += 1;
									continue;
								}
								if (candidato.causaOmision) {
									omittedCount += 1;
									diagnostics.push({
										sourceType: candidato.origenTipo,
										sourceId: candidato.origenId,
										cause: candidato.causaOmision,
									});
									continue;
								}
								const result = await replayEvento(
									tx,
									{ tenantId, userId: actorId },
									candidato.evento,
									periodo.periodoId,
									capability,
								);
								if (result.estado === 'CONTABILIZADO') {
									postedCount += 1;
									if (result.asientoId) {
										await tx.asiento.update({
											where: { asientoId: result.asientoId },
											data: { replayRunId: run.replayRunId },
										});
									}
								} else if (result.estado === 'YA_EXISTENTE') {
									alreadyPostedCount += 1;
								} else {
									omittedCount += 1;
									diagnostics.push({
										sourceType: candidato.origenTipo,
										sourceId: candidato.origenId,
										cause: `REPLAY_${result.estado}`,
									});
								}
							}
						},
					);

					const causes = diagnostics.map((item) => item.cause);
					const entries = await tx.asiento.findMany({
						where: {
							tenantId,
							OR: snapshot.sources.map((source) => ({
								origenTipo: source.identity.sourceType,
								origenId: source.identity.sourceId,
							})),
						},
						include: { lineas: true },
					});
					const reconciliation = reconcileReplaySnapshot(current, entries, run.replayRunId);
					const status =
						omittedCount > 0 || reconciliation.status !== 'CONFORME' ? 'NO_CONFORME' : 'COMPLETED';
					await tx.replayRun.update({
						where: { replayRunId: run.replayRunId },
						data: {
							status,
							postedCount,
							omittedCount,
							completedAt: new Date(),
							ambiguousCount: causes.filter((cause) => cause === 'IDENTIDAD_AMBIGUA').length,
							noFxCount: causes.filter((cause) => cause === 'FX_NO_VERIFICABLE').length,
							noCostCount: causes.filter((cause) => cause.includes('COSTO')).length,
							outOfPeriodCount: causes.filter((cause) => cause === 'FUERA_DE_PERIODO').length,
							diagnostic: {
								periodGuardBypass,
								alreadyPostedCount,
								omissions: diagnostics,
								reconciliation,
							} as Prisma.InputJsonValue,
						},
					});
					await tx.$executeRawUnsafe('RELEASE SAVEPOINT replay_period_postings');
					return {
						ok: true as const,
						result: {
							replayRunId: run.replayRunId,
							status,
							reconciliation,
							contabilizados: postedCount,
							yaPosteados: alreadyPostedCount,
							omitidos: omittedCount,
						},
					};
				} catch (error) {
					// Un fallo de serializacion aborta la transaccion entera: no se
					// intenta el savepoint ni se consulta el cliente abortado.
					if (isRetryableReplayTransactionError(error)) throw error;
					await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT replay_period_postings');
					await tx.replayRun.update({
						where: { replayRunId: run.replayRunId },
						data: {
							status: 'FAILED',
							completedAt: new Date(),
							diagnostic: {
								periodGuardBypass,
								error:
									error instanceof Error
										? error.message.slice(0, 500)
										: 'Unknown replay failure',
							} as Prisma.InputJsonValue,
						},
					});
					return { ok: false as const, error };
				}
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 },
		);

	let execution: Awaited<ReturnType<typeof executeAttempt>>;
	for (let attempt = 1; ; attempt += 1) {
		try {
			execution = await executeAttempt();
			break;
		} catch (error) {
			if (!isRetryableReplayTransactionError(error) || attempt >= REPLAY_TRANSACTION_MAX_ATTEMPTS) {
				throw error;
			}
		}
	}
	if (!execution.ok) throw execution.error;
	return execution.result;
}

/**
 * @description Bloquea el periodo para que dos ejecuciones no compitan.
 * @param {Prisma.TransactionClient} tx - Transaccion activa.
 * @param {string} tenantId - Tenant del periodo.
 * @param {string} periodoId - Periodo contable bloqueado.
 * @returns {Promise<void>} Resuelve cuando el bloqueo esta tomado.
 */
async function lockPeriodo(
	tx: Prisma.TransactionClient,
	tenantId: string,
	periodoId: string,
): Promise<void> {
	await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId} || ':' || ${periodoId}, 0))::text AS locked`;
}
