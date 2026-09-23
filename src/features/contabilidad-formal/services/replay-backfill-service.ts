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

import { prisma } from '@/lib/prisma';
import { replayEvento } from '@/features/contabilidad-formal/services/posting-engine';
import type { EventoContableInput } from '@/features/contabilidad-formal/services/posting-engine';

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
}

/** Normaliza montos persistidos (Decimal → number) para los builders. */
function n(v: unknown): number {
	return Number(v ?? 0);
}

/**
 * @description Reconstruye TODOS los candidatos al replay del tenant leyendo
 * las fuentes operativas históricas y mapeándolas al evento formal equivalente
 * (mismo builder que el writer operativo usa hoy).
 * @param {string} tenantId - Tenant propietario.
 * @returns {Promise<CandidatoReplay[]>} Candidatos con su fecha de negocio.
 */
export async function recolectarCandidatos(tenantId: string): Promise<CandidatoReplay[]> {
	const [
		ventas,
		gastos,
		servicios,
		ajustes,
		transferencias,
		inyecciones,
		pagosCapital,
		mermas,
		comprasCredito,
		facturasCredito,
		anticipos,
	] = await Promise.all([
		prisma.reconciliacionVenta.findMany({
			where: { tenantId },
			include: { venta: { select: { factura: { select: { idFactura: true } } } } },
		}),
		prisma.reconciliacionGasto.findMany({ where: { tenantId } }),
		prisma.reconciliacionServicio.findMany({ where: { tenantId } }),
		prisma.ajusteBancario.findMany({ where: { tenantId } }),
		prisma.transferenciaBancaria.findMany({ where: { tenantId } }),
		prisma.inyeccionCapital.findMany({ where: { tenantId } }),
		prisma.pagoDeuda.findMany({ where: { tenantId } }),
		prisma.merma.findMany({ where: { tenantId } }),
		prisma.compraDocumento.findMany({
			where: { tenantId, cuentaPorPagarId: { not: null } },
		}),
		prisma.factura.findMany({ where: { tenantId, tipoDocumento: 'FACTURA' } }),
		prisma.anticipo.findMany({ where: { tenantId } }),
	]);

	const candidatos: CandidatoReplay[] = [];

	for (const r of ventas) {
		if (r.tipoReconciliacion === 'PRESTAMO_CASH_DESEMBOLSO' || r.tipoReconciliacion === 'DEUDA_CASH_DESEMBOLSO') {
			continue; // el desembolso se posteó desde el préstamo/deuda
		}
		const esCredito = Boolean(r.venta?.factura);
		const tipo = r.prestamoCashId
			? 'COBRO_PRESTAMO'
			: r.deudaCashId
				? 'PAGO_DEUDA'
				: esCredito
					? 'COBRO_CXC'
					: 'VENTA_CONTADO';
		candidatos.push(crear(r.fechaReconciliacion, 'reconciliacion_venta', r.reconciliacionId, baseValoracion(r, 1, 'reconciliacion_venta', r.reconciliacionId, tipo), r.cuentaId));
	}

	for (const r of gastos) {
		const tipo = r.cuentaPorPagarId
			? 'PAGO_CXP'
			: r.pgId
				? 'PAGO_NOMINA'
				: r.gastoCompraId
					? 'COMPRA_CONTADO'
					: r.tipoGasto === 'servicio'
						? 'GASTO_CON_ANTICIPO_PROVEEDOR'
						: 'GASTO_CONTADO';
		candidatos.push(crear(r.fechaReconciliacion, 'reconciliacion_gasto', r.reconciliacionId, baseValoracion(r, 1, 'reconciliacion_gasto', r.reconciliacionId, tipo), r.cuentaId));
	}

	for (const r of servicios) {
		candidatos.push(crear(r.fechaReconciliacion, 'reconciliacion_servicio', r.reconciliacionId, baseValoracion(r, 1, 'reconciliacion_servicio', r.reconciliacionId, 'COBRO_SERVICIO'), r.cuentaId));
	}

	for (const a of ajustes) {
		candidatos.push(crear(a.fechaOperacion ?? a.createdAt, 'ajuste_bancario', a.ajusteId, baseValoracion(a, 1, 'ajuste_bancario', a.ajusteId, a.tipo === 'egreso' ? 'AJUSTE_BANCARIO_CARGO' : 'AJUSTE_BANCARIO_ABONO')));
	}

	for (const t of transferencias) {
		candidatos.push(crear(t.fechaTransferencia, 'transferencia_bancaria', t.transferenciaId, baseValoracion({ ...t, montoConvertido: t.montoDestino }, 1, 'transferencia_bancaria', t.transferenciaId, 'TRANSFERENCIA_BANCARIA', t.montoOrigen)));
	}

	for (const ci of inyecciones) {
		const capitalTipo = ci.tipo === 'DEUDA_EXTERNA' ? 'DEUDA_RECIBIDA' : 'INYECCION_CAPITAL';
		candidatos.push(crear(ci.fechaRegistro, 'inyeccion_capital', ci.id, baseValoracion(ci, 1, 'inyeccion_capital', ci.id, capitalTipo, ci.montoRecibido), ci.cuentaId));
	}

	for (const p of pagosCapital) {
		candidatos.push(crear(p.createdAt, 'pago_deuda_capital', p.id, baseValoracion(p, 1, 'pago_deuda_capital', p.id, 'PAGO_DEUDA_CAPITAL', p.montoPagado), p.cuentaId));
	}

	for (const m of mermas) {
		candidatos.push(crear(m.createdAt, 'merma', m.mermaId, baseValoracion(m, 1, 'merma', m.mermaId, 'MERMA_INVENTARIO', m.costoTotal)));
	}

	for (const c of comprasCredito) {
		candidatos.push(crear(c.fechaCompra, 'compra_documento', c.compraDocumentoId, baseValoracion(c, 1, 'compra_documento', c.compraDocumentoId, 'COMPRA_CREDITO', c.total)));
	}

	for (const f of facturasCredito) {
		candidatos.push(crear(f.fechaEmision, 'factura', f.idFactura, baseValoracion(f, 1, 'factura', f.idFactura, 'VENTA_CREDITO', f.total)));
	}

	for (const a of anticipos) {
		candidatos.push(crear(a.createdAt, 'anticipo', a.anticipoId, baseValoracion(a, 1, 'anticipo', a.anticipoId, a.tipo === 'COBRO' ? 'ANTICIPO_CLIENTE_RECIBIDO' : 'ANTICIPO_PROVEEDOR_ENTREGADO', a.montoOriginal), a.cuentaOrigenId));
	}
	return candidatos;
}

/** Empaqueta un candidato: la fecha histórica manda en el asiento resultante. */
function crear(fecha: Date, origenTipo: string, origenId: string, evento: EventoContableInput, cuentaId?: string | null): CandidatoReplay {
	return { origenTipo, origenId, fecha, evento: { ...evento, fecha }, cuentaId };
}

/** Construye el EventoContableInput base de una fila fuente (montos en su moneda). */
function baseValoracion(
	fila: {
		monto?: unknown;
		moneda?: unknown;
		montoConvertido?: unknown;
		tasaCambio?: unknown;
		fxEvidenceFingerprint?: unknown;
		descripcion?: unknown;
		observaciones?: unknown;
	},
	_orden: number,
	origenTipo: string,
	origenId: string,
	tipo: string,
	montoOverride?: unknown,
): EventoContableInput {
	const monto = n(montoOverride ?? fila.monto);
	const moneda = (fila.moneda as string | null) ?? 'CUP';
	const montoConvertido = fila.montoConvertido as number | null;
	const tasa = fila.tasaCambio as number | null;
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
		montoFuncional: montoConvertido ?? monto,
		monedaFuncional: 'CUP',
		tasaCambio: tasa,
		fxEvidenceFingerprint: (fila.fxEvidenceFingerprint as string | null) ?? null,
	};
}

/**
 * @description Dry-run obligatorio antes de ejecutar: agrupa los candidatos por
 * período y reporta cuántos crearían asiento nuevo.
 * @param {string} tenantId - Tenant propietario.
 * @returns {Promise<PlanBackfill>} Plan separado por período.
 */
export async function planBackfillContable(tenantId: string): Promise<PlanBackfill> {
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
	const periodoPorId = new Map(periodos.map((p) => [p.periodoId, p]));

	for (const candidato of candidatos) {
		if (posteados.has(`${candidato.origenTipo}:${candidato.origenId}`)) {
			yaPosteadosTotal += 1;
			const periodo = periodoPorId.get(encuentraPeriodoId(periodosRows, candidato.fecha) ?? '');
			if (periodo) periodo.yaPosteados += 1;
			continue;
		}
		const periodoEnc = encuentraPeriodoId(periodosRows, candidato.fecha);
		if (!periodoEnc) {
			sinPeriodo += 1;
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

/**
 * @description Ejecuta el replay del período: postea en orden cronológico cada
 * candidato cuya fecha cae dentro de sus rangos. Crea UNA transacción por
 * período para mantener el aislamiento atómico del replay.
 * @param {string} tenantId - Tenant propietario.
 * @param {string} periodoId - Período a rellenar (se valida existencia y fechas).
 * @param {string} actorId - Usuario que confirma la ejecución.
 * @returns {Promise<ResultadoBackfillPeriodo>} Conteos finales del replay.
 */
export async function ejecutarBackfillPeriodo(
	tenantId: string,
	periodoId: string,
	actorId: string,
): Promise<ResultadoBackfillPeriodo> {
	const periodo = await prisma.periodoContable.findFirst({
		where: { periodoId, tenantId },
	});
	if (!periodo) return { contabilizados: 0, yaPosteados: 0, omitidos: 0 };

	const [candidatos, existentes] = await Promise.all([
		recolectarCandidatos(tenantId),
		prisma.asiento.findMany({
			where: { tenantId },
			select: { origenTipo: true, origenId: true },
		}),
	]);
	const posteados = new Set(existentes.map((a) => `${a.origenTipo}:${a.origenId}`));

	const delPeriodo = candidatos
		.filter((c) => c.fecha >= periodo.fechaInicio && c.fecha <= periodo.fechaFin)
		.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

	let contabilizados = 0;
	let yaPosteados = 0;
	let omitidos = 0;

	return prisma.$transaction(async (tx) => {
		for (const candidato of delPeriodo) {
			if (posteados.has(`${candidato.origenTipo}:${candidato.origenId}`)) {
				yaPosteados += 1;
				continue;
			}
			const resultado = await replayEvento(
				tx as never,
				{ tenantId, userId: actorId },
				candidato.evento,
				periodo.periodoId,
			);
			if (resultado.estado === 'CONTABILIZADO') {
				contabilizados += 1;
			} else if (resultado.estado === 'YA_EXISTENTE') {
				yaPosteados += 1;
			} else {
				omitidos += 1;
			}
		}
		return { contabilizados, yaPosteados, omitidos };
	});
}
