/**
 * @description Backfill histórico opt-in (CTA-4): reconstruye asientos desde
 * las operaciones ya registradas en la base caja. Dos operaciones separadas:
 *
 *  1. `planBackfillContable` (dry-run obligatorio previo): clasifica cada evento
 *     potencial por período y reporta `replayables` / `yaPosteados` / `sinPeriodo`;
 *     nunca escribe. La UI muestra el plan antes de pedir confirmación.
 *  2. `ejecutarBackfillPeriodo`: postea los eventos del período en orden
 *     cronológico via `replayEvento` (sin guard de períodos: los históricos
 *     están cerrados por definición; la autoridad es la aprobación de ese mismo
 *     período). Cada reintento es seguro gracias a la idempotencia por origen.
 *
 * v1 cubre: ventas/cobros (ReconciliacionVenta), gastos (ReconciliacionGasto),
 * cobros de servicios, ajustes bancarios, transferencias, inyecciones de capital,
 * pagos de deuda de capital, mermas (a su costo), compras a crédito, facturas
 * (venta a crédito) y anticipos (creación). La aplicación de anticipos y las
 * devoluciones históricas quedan fuera del replay inicial: sus orígenes se
 * revisan con el tenant antes de un replay manual dirigido (ver design §5).
 * @module src/features/contabilidad-formal/services/replay-backfill-service
 */

import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import {
	ASIENTO_LINEA_MONTO_LIMIT,
	ASIENTO_LINEA_TASA_LIMIT,
	replayEvento,
	serializarDecimalEntrada,
} from '@/features/contabilidad-formal/services/posting-engine';
import type {
	EventoContableInput,
} from '@/features/contabilidad-formal/services/posting-engine';
import { reconcileReplaySnapshot } from '@/features/contabilidad-formal/services/replay-reconciliation';
import { decimalFuncional } from '@/features/contabilidad-formal/services/decimal-contable';
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';
import {
	computeReplayPreflightDigest,
	REPLAY_PREFLIGHT_DIGEST_VERSION,
	type ReplayPreflightDigestSnapshot,
	type ReplayPreflightSourceSnapshot,
} from '@/features/contabilidad-formal/services/replay-preflight-digest';

import {
  requireCurrentReplayPermission, requireCurrentReplayEntitlement, withReplayPostingCapability,
} from '@/features/contabilidad-formal/services/replay-posting-capability';

const REPLAY_DIGEST_VERSION = 2;
const REPLAY_TTL_MS = 24 * 60 * 60 * 1000;
const REPLAY_TRANSACTION_MAX_ATTEMPTS = 3;

/** Retries only database serialization/deadlock failures, never business errors. */
function isRetryableReplayTransactionError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;
	const candidate = error as { code?: unknown; meta?: { code?: unknown; cause?: unknown } };
	return candidate.code === 'P2034' || candidate.code === '40001' || candidate.code === '40P01' ||
		candidate.meta?.code === '40001' || candidate.meta?.code === '40P01' ||
		candidate.meta?.cause === '40001' || candidate.meta?.cause === '40P01';
}

/** Periodo contable mapeado por fechas para el dry-run. */
export interface PeriodoBackfill {
	periodoId: string;
	codigo: string;
	fechaInicio: Date;
	fechaFin: Date;
	replayables: number;
	yaPosteados: number;
}

/** Resultado del dry-run. */
export interface PlanBackfill {
	periodos: PeriodoBackfill[];
	totalEvaluados: number;
	yaPosteados: number;
	sinPeriodo: number;
	omitidos: Array<{ origenTipo: string; origenId: string; causa: string }>;
}

/** Resultado de la ejecución de un período. */
export interface ResultadoBackfillPeriodo {
	contabilizados: number;
	yaPosteados: number;
	omitidos: number;
}

/** Candidato reconstruido con evento listo para postear. */
interface CandidatoReplay {
	origenTipo: string;
	origenId: string;
	fecha: Date;
	evento: EventoContableInput;
	cuentaId?: string | null;
	causaOmision?: string;
}

type EventoBackfill = EventoContableInput & { causaOmision?: string };

/** Convierte evidencia de origen a Decimal sin redondeo ni límites IEEE-754. */
function decimalOrigen(
	v: unknown,
	storageLimit?: { precision: number; scale: number },
): Prisma.Decimal | null {
	if (v === null || v === undefined || v === '') return null;
	try {
		if (typeof v !== 'string' && typeof v !== 'number' && !(v instanceof Prisma.Decimal)) {
			return null;
		}
		const decimal = new Prisma.Decimal(serializarDecimalEntrada(v, 'DECIMAL_ORIGEN', storageLimit));
		return decimal.isFinite() ? decimal : null;
	} catch {
		return null;
	}
}

/**
 * @description Reconstruye TODOS los candidatos al replay del tenant leyendo
 * las fuentes operativas históricas y mapeándolas al evento formal equivalente
 * (mismo builder que el writer operativo usa hoy).
 * @param {string} tenantId - Tenant propietario.
 * @returns {Promise<CandidatoReplay[]>} Candidatos con su fecha de negocio.
 */
export async function recolectarCandidatos(
	tenantId: string,
	client: typeof prisma | Prisma.TransactionClient = prisma,
): Promise<CandidatoReplay[]> {
	const [
		ventas,
		gastos,
		servicios,
		ajustes,
		transferencias,
		inyecciones,
		prestamos,
		deudas,
		pagosSalario,
		gastosDiferidos,
		comprasOrigen,
		cuentasPorPagar,
		pagosCapital,
		mermas,
		comprasCredito,
		facturasCredito,
		anticipos,
		policy,
	] = await Promise.all([
		client.reconciliacionVenta.findMany({
			where: { tenantId },
			include: { venta: { select: { factura: { select: { idFactura: true } } } } },
		}),
		client.reconciliacionGasto.findMany({ where: { tenantId } }),
		client.reconciliacionServicio.findMany({ where: { tenantId } }),
		client.ajusteBancario.findMany({ where: { tenantId } }),
		client.transferenciaBancaria.findMany({ where: { tenantId } }),
		client.inyeccionCapital.findMany({ where: { tenantId } }),
		client.prestamoCash.findMany({ where: { tenantId, deletedAt: null } }),
		client.deudaCash.findMany({ where: { tenantId, deletedAt: null } }),
		client.pagosalario.findMany({ where: { tenantId } }),
		client.gastosDE.findMany({ where: { tenantId } }),
		client.gastoCompra.findMany({ where: { tenantId, deletedAt: null } }),
		client.cuentaPorPagar.findMany({ where: { tenantId, deletedAt: null } }),
		client.pagoDeuda.findMany({ where: { tenantId } }),
		client.merma.findMany({ where: { tenantId } }),
		client.compraDocumento.findMany({
			where: { tenantId, cuentaPorPagarId: { not: null } },
		}),
		client.factura.findMany({ where: { tenantId, tipoDocumento: 'FACTURA' } }),
		client.anticipo.findMany({ where: { tenantId } }),
		client.tenantAccountingPolicy.findUnique({
			where: { tenantId },
			select: { functionalCurrencyCode: true },
		}),
	]);
	const monedaFuncionalTenant = policy?.functionalCurrencyCode?.trim().toUpperCase() ?? null;
	const prestamoCashIds = new Set(
		prestamos.filter((prestamo) => prestamo.tenantId === tenantId).map((prestamo) => prestamo.id),
	);
	const deudaCashIds = new Set(
		deudas.filter((deuda) => deuda.tenantId === tenantId).map((deuda) => deuda.id),
	);
	const pagoSalarioIds = new Set(pagosSalario.filter((pago) => pago.tenantId === tenantId).map((pago) => pago.pgId));
	const gastoDiferidoIds = new Set(gastosDiferidos.filter((gasto) => gasto.tenantId === tenantId).map((gasto) => gasto.gastosDEId));
	const compraOrigenIds = new Set(
		comprasOrigen
			.filter((compra) => compra.tenantId === tenantId && compra.deletedAt === null)
			.map((compra) => compra.gastoCompraId),
	);
	const cuentaPorPagarById = new Map(
		cuentasPorPagar
			.filter((cuenta) => cuenta.tenantId === tenantId && cuenta.deletedAt === null)
			.map((cuenta) => [cuenta.cuentaPorPagarId, cuenta]),
	);

	const candidatos: CandidatoReplay[] = [];

	for (const r of ventas) {
		const tipoReconciliacion = r.tipoReconciliacion;
		let tipo: string;
		let causaOmision: string | undefined;
		if (tipoReconciliacion === 'PRESTAMO_CASH_DESEMBOLSO') {
			tipo = 'PRESTAMO_OTORGADO';
			causaOmision = 'FUENTE_CANONICA_PRESTAMO_CASH';
		} else if (tipoReconciliacion === 'DEUDA_CASH_DESEMBOLSO') {
			tipo = 'DEUDA_RECIBIDA';
			causaOmision = 'FUENTE_CANONICA_DEUDA_CASH';
		} else if (
			tipoReconciliacion === 'PRESTAMO_CASH' &&
			r.prestamoCashId &&
			prestamoCashIds.has(r.prestamoCashId)
		) {
			tipo = 'COBRO_PRESTAMO';
		} else if (
			tipoReconciliacion === 'DEUDA_CASH' &&
			r.deudaCashId &&
			deudaCashIds.has(r.deudaCashId)
		) {
			tipo = 'PAGO_DEUDA';
		} else if (
			(tipoReconciliacion === 'PRESTAMO_CASH' &&
				(!r.prestamoCashId || !prestamoCashIds.has(r.prestamoCashId))) ||
			(tipoReconciliacion === 'DEUDA_CASH' &&
				(!r.deudaCashId || !deudaCashIds.has(r.deudaCashId)))
		) {
			tipo = tipoReconciliacion === 'PRESTAMO_CASH' ? 'COBRO_PRESTAMO' : 'PAGO_DEUDA';
			causaOmision = 'REFERENCIA_CASH_NO_VERIFICABLE';
		} else if (
			(tipoReconciliacion === null || tipoReconciliacion === undefined || tipoReconciliacion === 'VENTA') &&
			!r.prestamoCashId && !r.deudaCashId
		) {
			const esCredito = Boolean(r.venta?.factura);
			tipo = esCredito ? 'COBRO_CXC' : 'VENTA_CONTADO';
		} else {
			tipo = 'VENTA_CONTADO';
			causaOmision = 'TIPO_RECONCILIACION_NO_VERIFICABLE';
		}
		const evento = baseValoracion(
			r,
			1,
			'reconciliacion_venta',
			r.reconciliacionId,
			tipo,
			undefined,
			monedaFuncionalTenant,
		);
		if (causaOmision) evento.causaOmision = causaOmision;
		candidatos.push(crear(r.fechaReconciliacion, 'reconciliacion_venta', r.reconciliacionId, evento, r.cuentaId));
	}

	for (const prestamo of prestamos) {
		if (prestamo.tenantId !== tenantId || prestamo.deletedAt !== null) continue;
		candidatos.push(crear(
			prestamo.fechaOtorgamiento,
			'prestamo_cash',
			prestamo.id,
			baseValoracion(
				prestamo,
				1,
				'prestamo_cash',
				prestamo.id,
				'PRESTAMO_OTORGADO',
				prestamo.montoCapital,
				monedaFuncionalTenant,
			),
			prestamo.cuentaBancariaId,
		));
	}

	for (const deuda of deudas) {
		if (deuda.tenantId !== tenantId || deuda.deletedAt !== null) continue;
		candidatos.push(crear(
			deuda.createdAt,
			'deuda_cash',
			deuda.id,
			baseValoracion(
				deuda,
				1,
				'deuda_cash',
				deuda.id,
				'DEUDA_RECIBIDA',
				deuda.montoCapital,
				monedaFuncionalTenant,
			),
			deuda.cuentaBancariaId,
		));
	}

	for (const r of gastos) {
		const referencias = [r.pgId, r.gastosDEId, r.gastoCompraId].filter(Boolean);
		const tipoValido = r.tipoGasto === 'salario' || r.tipoGasto === 'gastoDE' || r.tipoGasto === 'compra';
		const cuentaPorPagar = r.cuentaPorPagarId
			? cuentaPorPagarById.get(r.cuentaPorPagarId)
			: null;
		const referenciaCuentaPorPagarValida = !r.cuentaPorPagarId
			? true
			: r.tipoGasto === 'compra'
				? Boolean(
					cuentaPorPagar?.gastoCompraId &&
					compraOrigenIds.has(cuentaPorPagar.gastoCompraId) &&
					!cuentaPorPagar.gastosDEId,
				)
				: r.tipoGasto === 'gastoDE'
					? Boolean(
						cuentaPorPagar?.gastosDEId === r.gastosDEId &&
						r.gastosDEId &&
						gastoDiferidoIds.has(r.gastosDEId) &&
						!cuentaPorPagar.gastoCompraId,
					)
					: false;
		const cuentaPorPagarGastoCompraId = cuentaPorPagar?.gastoCompraId ?? null;
		const referenciaCompraDirectaValida = !r.gastoCompraId || compraOrigenIds.has(r.gastoCompraId);
		const referenciaCuentaCompraValida = !r.cuentaPorPagarId || Boolean(
			cuentaPorPagarGastoCompraId &&
			compraOrigenIds.has(cuentaPorPagarGastoCompraId) &&
			!cuentaPorPagar?.gastosDEId,
		);
		const referenciasCompraCoinciden = !r.gastoCompraId ||
			!cuentaPorPagarGastoCompraId ||
			r.gastoCompraId === cuentaPorPagarGastoCompraId;
		const referenciaCompraValida = Boolean(
			(r.gastoCompraId || r.cuentaPorPagarId) &&
			referenciaCompraDirectaValida &&
			referenciaCuentaCompraValida &&
			referenciasCompraCoinciden,
		);
		const referenciaValida = r.tipoGasto === 'salario'
			? Boolean(r.pgId && pagoSalarioIds.has(r.pgId) && referenciaCuentaPorPagarValida)
			: r.tipoGasto === 'gastoDE'
				? Boolean(
					r.gastosDEId &&
					gastoDiferidoIds.has(r.gastosDEId) &&
					referenciaCuentaPorPagarValida,
				)
				: r.tipoGasto === 'compra'
					? referenciaCompraValida && referenciaCuentaPorPagarValida
					: false;
		const eventoPorTipo = r.tipoGasto === 'salario'
			? 'PAGO_NOMINA'
			: r.tipoGasto === 'gastoDE'
				? 'GASTO_CONTADO'
				: 'COMPRA_CONTADO';
		const eventoTipo = r.cuentaPorPagarId ? 'PAGO_CXP' : eventoPorTipo;
		const evento = baseValoracion(
			r,
			1,
			'reconciliacion_gasto',
			r.reconciliacionId,
			eventoTipo,
			undefined,
			monedaFuncionalTenant,
		);
		if (!tipoValido) evento.causaOmision = 'TIPO_GASTO_NO_VERIFICABLE';
		else if (referencias.length > 1) {
			evento.causaOmision = referencias.length > 1
				? 'REFERENCIA_GASTO_AMBIGUA'
				: 'REFERENCIA_GASTO_NO_VERIFICABLE';
		} else if (
			!referenciaValida ||
			(r.cuentaPorPagarId && !cuentaPorPagar)
		) {
			evento.causaOmision = 'REFERENCIA_GASTO_NO_VERIFICABLE';
		}
		candidatos.push(crear(r.fechaReconciliacion, 'reconciliacion_gasto', r.reconciliacionId, evento, r.cuentaId));
	}

	for (const r of servicios) {
		candidatos.push(crear(r.fechaReconciliacion, 'reconciliacion_servicio', r.reconciliacionId, baseValoracion(r, 1, 'reconciliacion_servicio', r.reconciliacionId, 'COBRO_SERVICIO', undefined, monedaFuncionalTenant), r.cuentaId));
	}

	for (const a of ajustes) {
		const tipoValido = a.tipo === 'ingreso' || a.tipo === 'egreso';
		const tipoEvento = a.tipo === 'egreso'
			? 'AJUSTE_BANCARIO_CARGO'
			: a.tipo === 'ingreso'
				? 'AJUSTE_BANCARIO_ABONO'
				: a.tipo;
		const evento = baseValoracion(
			a,
			1,
			'ajuste_bancario',
			a.ajusteId,
			tipoEvento,
			undefined,
			monedaFuncionalTenant,
		);
		if (!tipoValido) evento.causaOmision = 'TIPO_AJUSTE_BANCARIO_NO_VERIFICABLE';
		candidatos.push(crear(a.fechaOperacion ?? a.createdAt, 'ajuste_bancario', a.ajusteId, evento));
	}

	for (const t of transferencias) {
		candidatos.push(crear(t.fechaTransferencia, 'transferencia_bancaria', t.transferenciaId, baseValoracion({ ...t, moneda: t.monedaOrigen }, 1, 'transferencia_bancaria', t.transferenciaId, 'TRANSFERENCIA_BANCARIA', t.montoOrigen, monedaFuncionalTenant)));
	}

	for (const ci of inyecciones) {
		const tipoValido = ci.tipo === 'CAPITAL_SOCIAL' || ci.tipo === 'DEUDA_EXTERNA';
		const capitalTipo = ci.tipo === 'DEUDA_EXTERNA' ? 'DEUDA_RECIBIDA' : 'INYECCION_CAPITAL';
		const evento = baseValoracion(
			ci,
			1,
			'inyeccion_capital',
			ci.id,
			capitalTipo,
			ci.montoRecibido,
			monedaFuncionalTenant,
		);
		if (!tipoValido) evento.causaOmision = 'TIPO_INYECCION_NO_VERIFICABLE';
		candidatos.push(crear(ci.fechaRegistro, 'inyeccion_capital', ci.id, evento, ci.cuentaId));
	}

	for (const p of pagosCapital) {
		candidatos.push(crear(p.createdAt, 'pago_deuda_capital', p.id, baseValoracion(p, 1, 'pago_deuda_capital', p.id, 'PAGO_DEUDA_CAPITAL', p.montoPagado, monedaFuncionalTenant), p.cuentaId));
	}

	for (const m of mermas) {
		const candidato = crear(
			m.createdAt,
			'merma',
			m.mermaId,
			baseValoracion(
				{ monto: m.costoTotal, moneda: null, montoConvertido: null, functionalCurrency: null },
				1,
				'merma',
				m.mermaId,
				'MERMA_INVENTARIO',
				undefined,
				monedaFuncionalTenant,
			),
		);
		if (m.costoTotal === null || m.costoTotal === undefined) {
			candidato.causaOmision = 'COSTO_NO_VERIFICABLE';
		} else {
			candidato.causaOmision = 'VALORACION_MONETARIA_NO_VERIFICABLE';
		}
		candidatos.push(candidato);
	}

	for (const c of comprasCredito) {
		candidatos.push(crear(c.fechaCompra, 'compra_documento', c.compraDocumentoId, baseValoracion(c, 1, 'compra_documento', c.compraDocumentoId, 'COMPRA_CREDITO', c.total, monedaFuncionalTenant)));
	}

	for (const f of facturasCredito) {
		candidatos.push(crear(f.fechaEmision, 'factura', f.idFactura, baseValoracion(f, 1, 'factura', f.idFactura, 'VENTA_CREDITO', f.total, monedaFuncionalTenant)));
	}

	for (const a of anticipos) {
		const tipoValido = a.tipo === 'COBRO' || a.tipo === 'PAGO';
		const tipoEvento = a.tipo === 'COBRO'
			? 'ANTICIPO_CLIENTE_RECIBIDO'
			: 'ANTICIPO_PROVEEDOR_ENTREGADO';
		const evento = baseValoracion(
			a,
			1,
			'anticipo',
			a.anticipoId,
			tipoEvento,
			a.montoOriginal,
			monedaFuncionalTenant,
		);
		if (!tipoValido) evento.causaOmision = 'TIPO_ANTICIPO_NO_VERIFICABLE';
		candidatos.push(crear(a.createdAt, 'anticipo', a.anticipoId, evento, a.cuentaOrigenId));
	}
	for (const candidato of candidatos) {
		if (candidato.causaOmision) continue;
		if (!monedaFuncionalTenant) {
			candidato.causaOmision = 'POLITICA_FUNCIONAL_AUSENTE';
		} else if (!candidato.evento.monedaFuncional) {
			candidato.causaOmision = 'MONEDA_FUNCIONAL_NO_VERIFICABLE';
		} else if (candidato.evento.monedaFuncional !== monedaFuncionalTenant) {
			candidato.causaOmision = 'MONEDA_FUNCIONAL_INCONSISTENTE';
		}
	}
	const candidatosPorOrigen = new Map<string, CandidatoReplay[]>();
	for (const candidato of candidatos) {
		const clave = `${candidato.origenTipo}:${candidato.origenId}`;
		const grupo = candidatosPorOrigen.get(clave) ?? [];
		grupo.push(candidato);
		candidatosPorOrigen.set(clave, grupo);
	}
	for (const grupo of candidatosPorOrigen.values()) {
		if (grupo.length > 1) {
			for (const candidato of grupo) candidato.causaOmision = 'IDENTIDAD_AMBIGUA';
		}
	}
	return candidatos;
}

/** Empaqueta un candidato: la fecha histórica manda en el asiento resultante. */
function crear(fecha: Date, origenTipo: string, origenId: string, evento: EventoBackfill, cuentaId?: string | null): CandidatoReplay {
	const { causaOmision: causaDelEvento, ...eventoListo } = evento;
	let causaOmision: string | undefined = causaDelEvento;
	const monto = decimalOrigen(evento.monto, ASIENTO_LINEA_MONTO_LIMIT);
	const montoFuncional = decimalOrigen(evento.montoFuncional);
	const tasa = decimalOrigen(evento.tasaCambio, ASIENTO_LINEA_TASA_LIMIT);
	if (!causaOmision) {
		if (!evento.moneda?.trim()) causaOmision = 'MONEDA_AUSENTE';
		else if (!monto?.gt(0) || !montoFuncional?.gt(0)) causaOmision = 'MONTO_NO_VERIFICABLE';
		else if (
			evento.moneda === evento.monedaFuncional &&
			monto && montoFuncional && !monto.eq(montoFuncional)
		) causaOmision = 'CONVERSION_MISMA_MONEDA_INCONSISTENTE';
		else if (
			evento.moneda !== evento.monedaFuncional &&
			(!tasa?.gt(0) || !evento.fxEvidenceFingerprint?.trim())
		) causaOmision = 'FX_NO_VERIFICABLE';
	}
	if (!causaOmision) {
		try {
			decimalFuncional(String(montoFuncional));
		} catch {
			causaOmision = 'PRECISION_FUNCIONAL_INVALIDA';
		}
	}
	if (!causaOmision) {
		try {
			serializarDecimalEntrada(montoFuncional!, 'MONTO_FUNCIONAL', ASIENTO_LINEA_MONTO_LIMIT);
		} catch {
			causaOmision = 'MONTO_NO_VERIFICABLE';
		}
	}
	return { origenTipo, origenId, fecha, evento: { ...eventoListo, fecha }, cuentaId, causaOmision };
}

/** Construye el EventoContableInput base de una fila fuente (montos en su moneda). */
function baseValoracion(
	fila: {
		monto?: unknown;
		moneda?: unknown;
		montoConvertido?: unknown;
		tasaCambio?: unknown;
		fxEvidenceFingerprint?: unknown;
		functionalCurrency?: unknown;
		rateEffectiveAt?: unknown;
		fxProvenanceKind?: unknown;
		fxProvenanceSource?: unknown;
		fxCatalogRateId?: unknown;
		fxEvidenceJson?: unknown;
		fxEvidenceVersion?: unknown;
		descripcion?: unknown;
		observaciones?: unknown;
	},
	_orden: number,
	origenTipo: string,
	origenId: string,
	tipo: string,
	montoOverride?: unknown,
	monedaFuncionalTenant?: string | null,
	): EventoBackfill {
	const montoDecimal = decimalOrigen(montoOverride ?? fila.monto, ASIENTO_LINEA_MONTO_LIMIT);
	const monto = montoDecimal ? serializarDecimalEntrada(montoDecimal) : new Prisma.Decimal(NaN);
	const moneda = ((fila.moneda as string | null) ?? '').trim().toUpperCase();
	const monedaFuncionalPersistida = (fila.functionalCurrency as string | null | undefined)
		?.trim().toUpperCase() ?? null;
	const monedaFuncional = monedaFuncionalPersistida
		?? (moneda && moneda === monedaFuncionalTenant ? monedaFuncionalTenant : null);
	const montoConvertidoDecimal = fila.montoConvertido === null || fila.montoConvertido === undefined
		? (moneda === monedaFuncional ? montoDecimal : null)
		: decimalOrigen(fila.montoConvertido);
	const montoConvertido = montoConvertidoDecimal
		? serializarDecimalEntrada(montoConvertidoDecimal)
		: new Prisma.Decimal(NaN);
	const tasaDecimal = decimalOrigen(fila.tasaCambio, ASIENTO_LINEA_TASA_LIMIT);
	const tasa = tasaDecimal ? serializarDecimalEntrada(tasaDecimal) : null;
	const hayMetadatosFx = tieneMetadatosFxPersistidos(fila);
	const evidenciaFxValida = evidenciaFxPersistidaVerificable({
		fila,
		monto: montoDecimal,
		montoConvertido: montoConvertidoDecimal,
		tasa: tasaDecimal,
		moneda,
		monedaFuncional,
	});
	const fxEvidenceFingerprint = evidenciaFxValida && hayMetadatosFx
		? (fila.fxEvidenceFingerprint as string)
		: null;
	const causaFxMismaMoneda = hayMetadatosFx && !evidenciaFxValida &&
		moneda !== '' && moneda === monedaFuncional
		? 'FX_NO_VERIFICABLE'
		: undefined;
	return {
		tipo: tipo as EventoContableInput['tipo'],
		fecha: new Date(),
		descripcion:
			(fila.descripcion as string | undefined) ??
			(fila.observaciones as string | undefined) ??
			`Replay histórico (${origenTipo} ${origenId})`,
		origen: { tipo: origenTipo, id: origenId },
		monto,
		moneda,
		montoFuncional: montoConvertido,
		monedaFuncional,
		tasaCambio: tasa,
		fxEvidenceFingerprint,
		causaOmision: causaFxMismaMoneda,
	};
}

/** Detecta cualquier rastro FX persistido, incluso uno incompleto. */
function tieneMetadatosFxPersistidos(fila: {
	tasaCambio?: unknown;
	rateEffectiveAt?: unknown;
	fxProvenanceKind?: unknown;
	fxProvenanceSource?: unknown;
	fxCatalogRateId?: unknown;
	fxEvidenceJson?: unknown;
	fxEvidenceFingerprint?: unknown;
	fxEvidenceVersion?: unknown;
}): boolean {
	return [
		fila.tasaCambio,
		fila.rateEffectiveAt,
		fila.fxProvenanceKind,
		fila.fxProvenanceSource,
		fila.fxCatalogRateId,
		fila.fxEvidenceJson,
		fila.fxEvidenceFingerprint,
		fila.fxEvidenceVersion,
	].some((value) => value !== null && value !== undefined);
}

/** Comprueba FX contra toda la evidencia versionada persistida cuando existe metadata. */
function evidenciaFxPersistidaVerificable(input: {
	fila: {
		rateEffectiveAt?: unknown;
		fxProvenanceKind?: unknown;
		fxProvenanceSource?: unknown;
		fxCatalogRateId?: unknown;
		fxEvidenceJson?: unknown;
		fxEvidenceFingerprint?: unknown;
		fxEvidenceVersion?: unknown;
		tasaCambio?: unknown;
	};
	monto: Prisma.Decimal | null;
	montoConvertido: Prisma.Decimal | null;
	tasa: Prisma.Decimal | null;
	moneda: string;
	monedaFuncional: string | null;
}): boolean {
	const { fila, monto, montoConvertido, tasa, moneda, monedaFuncional } = input;
	if (!moneda || !monedaFuncional) return true;
	const mismaMoneda = moneda === monedaFuncional;
	if (mismaMoneda && !tieneMetadatosFxPersistidos(fila)) return true;
	if (
		!monto || !montoConvertido || (!mismaMoneda && !tasa) ||
		(mismaMoneda
			? fila.rateEffectiveAt !== null && fila.rateEffectiveAt !== undefined
			: !(fila.rateEffectiveAt instanceof Date)) ||
		(mismaMoneda
			? fila.fxProvenanceKind !== 'SAME_CURRENCY'
			: !['MANUAL_GOVERNED', 'CATALOG_RATE'].includes(String(fila.fxProvenanceKind))) ||
		typeof fila.fxProvenanceSource !== 'string' || !fila.fxProvenanceSource.trim() ||
		(mismaMoneda
			? fila.fxCatalogRateId !== null || (tasa !== null && !tasa.eq(1))
			: !(fila.fxCatalogRateId === null || typeof fila.fxCatalogRateId === 'string')) ||
		fila.fxEvidenceVersion !== 2 ||
		typeof fila.fxEvidenceFingerprint !== 'string' || !fila.fxEvidenceFingerprint.trim() ||
		!fila.fxEvidenceJson || typeof fila.fxEvidenceJson !== 'object' || Array.isArray(fila.fxEvidenceJson)
	) return false;

	try {
		const source = fila.fxProvenanceSource as string;
		const catalogRateId = fila.fxCatalogRateId as string | null;
		const expected = buildAppliedFxEvidenceExact({
			originalAmount: monto,
			originalCurrency: moneda,
			functionalCurrency: monedaFuncional,
			exchangeRate: tasa,
			convertedAmount: montoConvertido,
			rateEffectiveAt: mismaMoneda ? null : fila.rateEffectiveAt as Date,
			source,
			fxCatalogRateId: catalogRateId,
			...(mismaMoneda
				? {}
				: { fxProvenanceKind: fila.fxProvenanceKind as 'MANUAL_GOVERNED' | 'CATALOG_RATE' }),
		});
		const persisted = fila.fxEvidenceJson as Record<string, unknown>;
		return expected.evidence.fxEvidenceFingerprint === fila.fxEvidenceFingerprint &&
			expected.evidence.fxEvidenceVersion === fila.fxEvidenceVersion &&
			Object.keys(persisted).length === Object.keys(expected.evidence).length &&
			Object.entries(expected.evidence).every(([key, value]) => persisted[key] === value);
	} catch {
		return false;
	}
}

/**
 * @description Dry-run obligatorio antes de ejecutar: agrupa los candidatos por
 * período y reporta cuántos crearían asiento nuevo.
 * @param {string} tenantId - Tenant propietario.
 * @returns {Promise<PlanBackfill>} Plan separado por período.
 */
export async function planBackfillContable(tenantId: string): Promise<PlanBackfill> {
	await requireCurrentReplayEntitlement(prisma, tenantId);
	const [periodosRows, asientosExistentes, candidatos] = await Promise.all([
		prisma.periodoContable.findMany({
			where: { tenantId },
			select: { periodoId: true, codigo: true, fechaInicio: true, fechaFin: true },
			orderBy: { fechaInicio: 'asc' },
		}),
		prisma.asiento.findMany({
			where: { tenantId },
			select: { origenTipo: true, origenId: true },
		}),
		recolectarCandidatos(tenantId),
	]);

	const posteados = new Set(asientosExistentes.map((a) => `${a.origenTipo}:${a.origenId}`));

	const periodos: PeriodoBackfill[] = periodosRows.map((p) => ({
		periodoId: p.periodoId,
		codigo: p.codigo ?? p.periodoId,
		fechaInicio: p.fechaInicio,
		fechaFin: p.fechaFin,
		replayables: 0,
		yaPosteados: 0,
	}));

	let sinPeriodo = 0;
	let yaPosteadosTotal = 0;
	const omitidos: PlanBackfill['omitidos'] = [];
	const periodoPorId = new Map(periodos.map((p) => [p.periodoId, p]));

	for (const candidato of candidatos) {
		if (candidato.causaOmision === 'IDENTIDAD_AMBIGUA') {
			omitidos.push({ origenTipo: candidato.origenTipo, origenId: candidato.origenId, causa: candidato.causaOmision });
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
			omitidos.push({ origenTipo: candidato.origenTipo, origenId: candidato.origenId, causa: 'FUERA_DE_PERIODO' });
			continue;
		}
		if (candidato.causaOmision) {
			omitidos.push({ origenTipo: candidato.origenTipo, origenId: candidato.origenId, causa: candidato.causaOmision });
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
 * @description Resuelve qué período contable contiene la fecha.
 */
function encuentraPeriodoId(
	periodos: Array<Pick<PeriodoBackfill, 'periodoId' | 'fechaInicio' | 'fechaFin'>>,
	fecha: Date,
): string | null {
	for (const p of periodos) {
		if (fecha >= p.fechaInicio && fecha <= p.fechaFin) return p.periodoId;
	}
	return null;
}

/** Resolves the legacy service entry point only through an existing approved preflight. */
export async function ejecutarBackfillPeriodo(
	tenantId: string,
	periodoId: string,
	actorId: string,
): Promise<ResultadoBackfillPeriodo> {
	await requireCurrentReplayEntitlement(prisma, tenantId);
	const preflight = await prisma.replayPreflight.findFirst({
		where: {
			tenantId,
			periodoId,
			status: 'APPROVED',
			expiresAt: { gt: new Date() },
			approval: { is: { status: 'APPROVED' } },
		},
		orderBy: { generatedAt: 'desc' },
		include: { approval: true },
	});
	if (!preflight?.approval) throw new Error('El replay requiere un preflight vigente y aprobado');
	return ejecutarBackfillAutorizado({
		tenantId,
		replayPreflightId: preflight.replayPreflightId,
		replayApprovalId: preflight.approval.replayApprovalId,
		actorId,
	});
}

type ReplayDb = typeof prisma | Prisma.TransactionClient;
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

/** Produces a single canonical row per source identity for the digest. */
async function snapshotPeriodo(
	client: ReplayDb,
	tenantId: string,
	periodoId: string,
): Promise<ReplayPreflightDigestSnapshot> {
	const periodo = await client.periodoContable.findFirst({ where: { tenantId, periodoId } });
	if (!periodo) throw new Error('Período contable no encontrado para el tenant');
	const [candidatos, asientos] = await Promise.all([
		recolectarCandidatos(tenantId, client),
		client.asiento.findMany({ where: { tenantId }, select: { origenTipo: true, origenId: true } }),
	]);
	const posteados = new Set(asientos.map((row) => `${row.origenTipo}:${row.origenId}`));
	const grupos = new Map<string, CandidatoReplay[]>();
	for (const candidato of candidatos) {
		if (candidato.fecha < periodo.fechaInicio || candidato.fecha > periodo.fechaFin) continue;
		const clave = `${candidato.origenTipo}:${candidato.origenId}`;
		grupos.set(clave, [...(grupos.get(clave) ?? []), candidato]);
	}
	const sources: ReplayPreflightSourceSnapshot[] = [];
	for (const [clave, grupo] of grupos) {
		const candidato = grupo[0];
		const [sourceType, sourceId] = [candidato.origenTipo, candidato.origenId];
		const cause = grupo.length > 1 ? 'IDENTIDAD_AMBIGUA' : candidato.causaOmision ?? null;
		const alreadyPosted = posteados.has(clave);
		const omitted = cause === 'IDENTIDAD_AMBIGUA' || (!alreadyPosted && cause !== null);
		const originalAmount = decimalOrigen(candidato.evento.monto);
		const functionalAmount = decimalOrigen(candidato.evento.montoFuncional);
		const rate = decimalOrigen(candidato.evento.tasaCambio);
		const auxiliary = candidato.evento.auxiliares;
		sources.push({
			identity: { sourceType, sourceId },
			classification: omitted ? 'OMITIDO' : alreadyPosted ? 'YA_POSTEADO' : 'REPLAYABLE',
			omissionCause: omitted ? cause : null,
			semantics: {
				tipo: candidato.evento.tipo,
				fecha: candidato.evento.fecha,
				descripcion: candidato.evento.descripcion,
				medioCobro: candidato.evento.medioCobro ?? null,
				referencia: candidato.evento.referencia ?? null,
				auxiliares: {
					costoFifo: decimalOrigen(auxiliary?.costoFifo)?.toString() ?? null,
					intereses: decimalOrigen(auxiliary?.intereses)?.toString() ?? null,
					montoPagado: decimalOrigen(auxiliary?.montoPagado)?.toString() ?? null,
					diferenciaFx: decimalOrigen(auxiliary?.diferenciaFx)?.toString() ?? null,
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
	return {
		tenantId,
		period: { periodId: periodo.periodoId, startsAt: periodo.fechaInicio, endsAt: periodo.fechaFin },
		sources,
	};
}

async function lockPeriodo(client: Prisma.TransactionClient, tenantId: string, periodoId: string) {
	await client.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId} || ':' || ${periodoId}, 0))::text AS locked`;
}

function validarPreflight(
	preflight: PreflightRecord,
	tenantId: string,
	now = new Date(),
	allowedStatuses: string[] = ['READY'],
) {
	if (
		preflight.tenantId !== tenantId || !allowedStatuses.includes(preflight.status) ||
		preflight.digestVersion !== REPLAY_DIGEST_VERSION ||
		preflight.expiresAt.getTime() !== preflight.generatedAt.getTime() + REPLAY_TTL_MS ||
		preflight.expiresAt <= now
	) throw new Error('Preflight inexistente, vencido o no vigente');
	const snapshot = preflight.snapshot as ReplayPreflightDigestSnapshot;
	if (
		snapshot.tenantId !== tenantId || snapshot.period.periodId !== preflight.periodoId ||
		computeReplayPreflightDigest(snapshot, REPLAY_PREFLIGHT_DIGEST_VERSION) !== preflight.digest
	) throw new Error('Digest de preflight inconsistente');
	return snapshot;
}

/** Persists a canonical snapshot and the fixed 24-hour approval window. */
export async function crearPreflightBackfill(tenantId: string, periodoId: string, requesterId: string) {
	await requireCurrentReplayEntitlement(prisma, tenantId);
	return prisma.$transaction(async (tx) => {
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
	}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Creates an immutable approval by a different active manager with current permission. */
export async function aprobarPreflightBackfill(tenantId: string, replayPreflightId: string, approverId: string) {
	await requireCurrentReplayEntitlement(prisma, tenantId);
	return prisma.$transaction(async (tx) => {
		await requireCurrentReplayEntitlement(tx, tenantId);
		const preflight = await tx.replayPreflight.findFirst({ where: { tenantId, replayPreflightId } }) as PreflightRecord | null;
		if (!preflight) throw new Error('Preflight no encontrado');
		await lockPeriodo(tx, tenantId, preflight.periodoId);
		const snapshot = validarPreflight(preflight, tenantId);
		if (approverId === preflight.requestedByUserId) throw new Error('La aprobación debe ser independiente');
		await requireCurrentReplayPermission(tx, tenantId, approverId);
		const currentSnapshot = await snapshotPeriodo(tx, tenantId, preflight.periodoId);
		if (computeReplayPreflightDigest(currentSnapshot, REPLAY_PREFLIGHT_DIGEST_VERSION) !== preflight.digest) {
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
		await tx.replayPreflight.update({ where: { replayPreflightId }, data: { status: 'APPROVED' } });
		return approval;
	});
}

export interface EjecutarBackfillAutorizadoInput {
	tenantId: string;
	replayPreflightId: string;
	replayApprovalId: string;
	actorId: string;
}

/** Executes exactly one approved period and records either outcome in one transaction. */
export async function ejecutarBackfillAutorizado(input: EjecutarBackfillAutorizadoInput) {
	const { tenantId, replayPreflightId, replayApprovalId, actorId } = input;
	await requireCurrentReplayEntitlement(prisma, tenantId);
	const executeAttempt = () => prisma.$transaction(async (tx) => {
		await requireCurrentReplayEntitlement(tx, tenantId);
		const preflight = await tx.replayPreflight.findFirst({ where: { tenantId, replayPreflightId } }) as PreflightRecord | null;
		if (!preflight) throw new Error('Preflight no encontrado');
		await lockPeriodo(tx, tenantId, preflight.periodoId);
		validarPreflight(preflight, tenantId, new Date(), ['APPROVED']);
		await requireCurrentReplayPermission(tx, tenantId, actorId);
		const approval = await tx.replayApproval.findFirst({
			where: { tenantId, replayPreflightId, replayApprovalId, status: 'APPROVED' },
		});
		if (
			!approval || approval.requestedByUserId !== preflight.requestedByUserId ||
			approval.approvedByUserId === preflight.requestedByUserId ||
			approval.digestVersion !== preflight.digestVersion || approval.digest !== preflight.digest
		) throw new Error('Aprobación no válida para este preflight');
		await requireCurrentReplayPermission(tx, tenantId, approval.approvedByUserId);
		const current = await snapshotPeriodo(tx, tenantId, preflight.periodoId);
		if (computeReplayPreflightDigest(current, REPLAY_PREFLIGHT_DIGEST_VERSION) !== preflight.digest) {
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
		// The run and all accounting writes share the outer transaction. This savepoint
		// allows a handled failure to undo every posting while retaining FAILED durably.
		await tx.$executeRawUnsafe('SAVEPOINT replay_period_postings');
		try {
			const [periodo, candidatos, existentes, snapshot] = await Promise.all([
				tx.periodoContable.findFirst({ where: { tenantId, periodoId: preflight.periodoId } }),
				recolectarCandidatos(tenantId, tx),
				tx.asiento.findMany({ where: { tenantId }, select: { origenTipo: true, origenId: true } }),
				snapshotPeriodo(tx, tenantId, preflight.periodoId),
			]);
			if (!periodo || computeReplayPreflightDigest(snapshot, REPLAY_PREFLIGHT_DIGEST_VERSION) !== preflight.digest) {
				throw new Error('El período o las fuentes cambiaron antes de contabilizar');
			}
			const posteados = new Set(existentes.map((row) => `${row.origenTipo}:${row.origenId}`));
			const delPeriodo = candidatos
				.filter((row) => row.fecha >= periodo.fechaInicio && row.fecha <= periodo.fechaFin)
				.sort((left, right) => left.fecha.getTime() - right.fecha.getTime());
			let postedCount = 0;
			let alreadyPostedCount = 0;
			let omittedCount = 0;
			const diagnostics: Array<{ sourceType: string; sourceId: string; cause: string }> = [];
			await withReplayPostingCapability(tx, {
				tenantId, userId: actorId, periodoId: periodo.periodoId, replayRunId: run.replayRunId,
			}, async (capability) => {
				for (const candidato of delPeriodo) {
					if (candidato.causaOmision === 'IDENTIDAD_AMBIGUA') {
						omittedCount += 1;
						diagnostics.push({ sourceType: candidato.origenTipo, sourceId: candidato.origenId, cause: candidato.causaOmision });
						continue;
					}
					if (posteados.has(`${candidato.origenTipo}:${candidato.origenId}`)) {
						alreadyPostedCount += 1;
						continue;
					}
					if (candidato.causaOmision) {
						omittedCount += 1;
						diagnostics.push({ sourceType: candidato.origenTipo, sourceId: candidato.origenId, cause: candidato.causaOmision });
						continue;
					}
					const result = await replayEvento(tx, { tenantId, userId: actorId }, candidato.evento, periodo.periodoId, capability);
					if (result.estado === 'CONTABILIZADO') {
						postedCount += 1;
						if (result.asientoId) {
							await tx.asiento.update({ where: { asientoId: result.asientoId }, data: { replayRunId: run.replayRunId } });
						}
					} else if (result.estado === 'YA_EXISTENTE') alreadyPostedCount += 1;
					else {
						omittedCount += 1;
						diagnostics.push({ sourceType: candidato.origenTipo, sourceId: candidato.origenId, cause: `REPLAY_${result.estado}` });
					}
				}
			});
			const causes = diagnostics.map((item) => item.cause);
			const entries = await tx.asiento.findMany({
				where: { tenantId, OR: snapshot.sources.map((source) => ({
					origenTipo: source.identity.sourceType, origenId: source.identity.sourceId,
				})) },
				include: { lineas: true },
			});
			const reconciliation = reconcileReplaySnapshot(current, entries, run.replayRunId);
			const status = omittedCount > 0 || reconciliation.status !== 'CONFORME'
				? 'NO_CONFORME' : 'COMPLETED';
			await tx.replayRun.update({
				where: { replayRunId: run.replayRunId },
				data: {
					status, postedCount, omittedCount, completedAt: new Date(),
					ambiguousCount: causes.filter((cause) => cause === 'IDENTIDAD_AMBIGUA').length,
					noFxCount: causes.filter((cause) => cause === 'FX_NO_VERIFICABLE').length,
					noCostCount: causes.filter((cause) => cause.includes('COSTO')).length,
					outOfPeriodCount: causes.filter((cause) => cause === 'FUERA_DE_PERIODO').length,
					diagnostic: { periodGuardBypass, alreadyPostedCount, omissions: diagnostics, reconciliation } as Prisma.InputJsonValue,
				},
			});
			await tx.$executeRawUnsafe('RELEASE SAVEPOINT replay_period_postings');
			return { ok: true as const, result: { replayRunId: run.replayRunId, status, reconciliation, contabilizados: postedCount, yaPosteados: alreadyPostedCount, omitidos: omittedCount } };
		} catch (error) {
			// A serialization/deadlock failure aborts the whole transaction. Do not
			// issue savepoint rollback or query the aborted client; retry outside it.
			if (isRetryableReplayTransactionError(error)) throw error;
			await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT replay_period_postings');
			await tx.replayRun.update({
				where: { replayRunId: run.replayRunId },
				data: {
					status: 'FAILED', completedAt: new Date(),
					diagnostic: {
						periodGuardBypass,
						error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown replay failure',
					} as Prisma.InputJsonValue,
				},
			});
			return { ok: false as const, error };
		}
	}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 });
	let execution: Awaited<ReturnType<typeof executeAttempt>>;
	for (let attempt = 1; ; attempt += 1) {
		try {
			execution = await executeAttempt();
			break;
		} catch (error) {
			if (!isRetryableReplayTransactionError(error) || attempt >= REPLAY_TRANSACTION_MAX_ATTEMPTS) throw error;
		}
	}
	if (!execution.ok) throw execution.error;
	return execution.result;
}
