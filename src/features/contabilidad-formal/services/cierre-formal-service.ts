/**
 * @description Asientos de cierre y apertura formales (CTA-3). El cierre se
 * genera cuando un período queda APROBADO; la apertura nace de los saldos que
 * AperturaPeriodo deriva al abrir el período siguiente.
 *
 *  - Cierre: cada cuenta de resultado (INGRESO/COSTO/GASTO) del período vacía
 *    su saldo neto hacia la cuenta de resultado del período.
 *  - Apertura: los saldos iniciales de AperturaPeriodo toman su contraparte en
 *    patrimonio + traspaso del resultado del período cerrado al acumulado.
 *  - Idempotentes por origen y reutilizan numeración + cadena del motor.
 * @module src/features/contabilidad-formal/services/cierre-formal-service
 */

import { prisma } from '@/lib/prisma';
import {
	insertarAsientoConNumeracion,
	type LineaAsientoResuelta,
	type PostingTx,
} from '@/features/contabilidad-formal/services/posting-engine';

/** Tipos de cuenta que constituyen el resultado (ingreso, costo y gasto). */
const TIPOS_RESULTADO = ['INGRESO', 'COSTO', 'GASTO'] as const;

/** Roles que gobiernan los asientos de cierre/apertura. */
const ROL_RESULTADO_PERIODO = 'RESULTADO_PERIODO';
const ROL_RESULTADOS_ACUMULADOS = 'RESULTADOS_ACUMULADOS';

/** Extensión de tx con las lecturas que los servicios CTA-3 necesitan. */
export interface CierreTx extends PostingTx {
	cuentaRolTenant: {
		findMany(args: { where: { tenantId: string }; include?: unknown }): Promise<
			Array<{ rol: string; cuenta: { cuentaContableId: string } }>
		>;
	};
	cuentaContable: {
		findMany(args: {
			where: { cuentaContableId: { in: string[] } };
			select?: unknown;
		}): Promise<Array<{ cuentaContableId: string; tipo: string; nombre: string; codigo: string }>>;
	};
	asientoLinea: {
		groupBy(args: {
			by: ['cuentaId'];
			where: Record<string, unknown>;
			_sum: { debe: true; haber: true };
		}): Promise<Array<{ cuentaId: string; _sum: { debe: unknown; haber: unknown } }>>;
		findFirst(args: {
			where: { asientoId: string; cuentaId: string };
		}): Promise<{ debe: unknown; haber: unknown } | null>;
	};
	aperturaPeriodo: {
		findUnique(args: { where: { periodoId: string }; select?: unknown }): Promise<{
			saldoCajaInicial: unknown;
			saldoBancoInicial: unknown;
			saldoCuentasCobrarInicial: unknown;
			saldoCuentasPagarInicial: unknown;
			saldoInventarioInicial: unknown;
			saldoCapitalInicial: unknown;
			saldoResultadoAcumInicial: unknown;
		} | null>;
	};
}

/** Parámetros de generación del asiento de cierre. */
export interface ParamsCierreFormal {
	periodoId: string;
	tenantId: string;
	actorId: string;
	fecha?: Date;
}

/** Parámetros de generación del asiento de apertura. */
export interface ParamsAperturaFormal {
	periodoId: string;
	tenantId: string;
	actorId: string;
	fecha: Date;
}

/** Resultado normalizado de una generación CTA-3. */
export interface ResultadoCierreFormal {
	estado: 'CONTABILIZADO' | 'OMITIDO' | 'YA_EXISTENTE';
	asientoId?: string;
	motivo?: string;
}

function modoForzado(): boolean {
	return process.env.CONTABILIDAD_FORMAL_MODE === 'enforce';
}

async function diarioAperturaCierre(tx: CierreTx, tenantId: string): Promise<string | null> {
	const diario = await tx.diario.findFirst({
		where: { tenantId, tipo: 'APERTURA_CIERRE' },
		select: { diarioId: true },
	});
	return diario?.diarioId ?? null;
}

/** Construye la línea de asiento del lado indicado con numeración creciente. */
function lineaDeLado(
	cuentaId: string,
	monto: number,
	lado: 'DEBE' | 'HABER',
	orden: number,
	referencia: string,
): LineaAsientoResuelta {
	return {
		orden,
		cuentaId,
		debe: lado === 'DEBE' ? monto : 0,
		haber: lado === 'HABER' ? monto : 0,
		monedaOriginal: 'CUP',
		montoOriginal: monto,
		tasaCambio: null,
		fxEvidenceFingerprint: null,
		referencia,
	};
}

/**
 * @description Saldo neto de una cuenta de resultado dentro del período.
 * INGRESO → haber − debe; COSTO/GASTO → debe − haber.
 */
function saldoNeto(tipo: string, suma: { debe: number; haber: number }): number {
	return tipo === 'INGRESO' ? suma.haber - suma.debe : suma.debe - suma.haber;
}

/**
 * @description Genera el asiento de cierre cuando el período queda APROBADO.
 * Idempotente por origen `cierre_periodo:<periodoId>`.
 * @param {CierreTx} tx - Transacción que contiene también las lecturas extra.
 * @param {ParamsCierreFormal} params - Período y actor del cierre.
 * @returns {Promise<ResultadoCierreFormal>} Resultado de la generación.
 */
export async function generarAsientoCierre(
	tx: CierreTx,
	params: ParamsCierreFormal,
): Promise<ResultadoCierreFormal> {
	if (!modoForzado()) return { estado: 'OMITIDO', motivo: 'MODO_NO_ENFORCE' };

	const existente = await tx.asiento.findFirst({
		where: { tenantId: params.tenantId, origenTipo: 'cierre_periodo', origenId: params.periodoId },
	});
	if (existente) return { estado: 'YA_EXISTENTE', asientoId: existente.asientoId };

	const roles = await tx.cuentaRolTenant.findMany({
		where: { tenantId: params.tenantId },
		include: { cuenta: true },
	});
	if (roles.length === 0) return { estado: 'OMITIDO', motivo: 'PLAN_NO_INICIALIZADO' };
	const rolMapa = new Map(roles.map((r) => [r.rol, r.cuenta.cuentaContableId]));
	const resultadoId = rolMapa.get(ROL_RESULTADO_PERIODO);
	if (!resultadoId) return { estado: 'OMITIDO', motivo: 'ROL_RESULTADO_SIN_MAPEAR' };

	const saldos = await tx.asientoLinea.groupBy({
		by: ['cuentaId'],
		where: {
			asiento: { tenantId: params.tenantId, periodoId: params.periodoId, estado: 'CONTABILIZADO' },
			cuenta: { tipo: { in: [...TIPOS_RESULTADO] } },
		},
		_sum: { debe: true, haber: true },
	});

	const cuentaIds = saldos.map((s) => s.cuentaId);
	const cuentasInfo = cuentaIds.length
		? await tx.cuentaContable.findMany({
				where: { cuentaContableId: { in: cuentaIds } },
				select: { cuentaContableId: true, tipo: true },
			})
		: [];
	const tipoPorCuenta = new Map(cuentasInfo.map((c) => [c.cuentaContableId, c.tipo]));

	let neto = 0;
	const lineas: LineaAsientoResuelta[] = [];
	let orden = 0;
	for (const suma of saldos) {
		const tipo = tipoPorCuenta.get(suma.cuentaId);
		if (!tipo) continue;
		const saldo = saldoNeto(tipo, {
			debe: Number(suma._sum.debe ?? 0),
			haber: Number(suma._sum.haber ?? 0),
		});
		if (Math.abs(saldo) <= 0.005) continue;
		orden += 1;
		lineas.push(lineaDeLado(suma.cuentaId, saldo, tipo === 'INGRESO' ? 'DEBE' : 'HABER', orden, 'Cierre'));
		neto += tipo === 'INGRESO' ? saldo : -saldo;
	}

	if (lineas.length === 0) return { estado: 'OMITIDO', motivo: 'SIN_MOVIMIENTOS_RESULTADO' };

	// Contrapartida: utilidad al haber del resultado; pérdida al debe.
	orden += 1;
	lineas.push(lineaDeLado(resultadoId, Math.abs(neto), neto >= 0 ? 'HABER' : 'DEBE', orden, 'Resultado del período'));

	const diarioId = await diarioAperturaCierre(tx, params.tenantId);
	if (!diarioId) return { estado: 'OMITIDO', motivo: 'DIARIO_NO_ENCONTRADO' };

	const resultado = await insertarAsientoConNumeracion(
		tx,
		{ tenantId: params.tenantId, userId: params.actorId },
		{
			diarioId,
			periodoId: params.periodoId,
			fecha: params.fecha ?? new Date(),
			descripcion: 'Cierre del período',
			origenTipo: 'cierre_periodo',
			origenId: params.periodoId,
			lineas,
			createdBy: params.actorId,
		},
	);
	return resultado.duplicado
		? { estado: 'YA_EXISTENTE', asientoId: resultado.asientoId }
		: { estado: 'CONTABILIZADO', asientoId: resultado.asientoId };
}

/**
 * @description Genera el asiento de apertura del período desde los saldos de
 * AperturaPeriodo más el traspaso del resultado del período cerrado al
 * acumulado. Idempotente por origen `apertura_periodo:<periodoId>`.
 * @param {CierreTx} tx - Transacción del alta del período.
 * @param {ParamsAperturaFormal} params - Período, tenant y actor.
 * @returns {Promise<ResultadoCierreFormal>} Resultado de la generación.
 */
export async function generarAsientoApertura(
	tx: CierreTx,
	params: ParamsAperturaFormal,
): Promise<ResultadoCierreFormal> {
	if (!modoForzado()) return { estado: 'OMITIDO', motivo: 'MODO_NO_ENFORCE' };

	const existente = await tx.asiento.findFirst({
		where: { tenantId: params.tenantId, origenTipo: 'apertura_periodo', origenId: params.periodoId },
	});
	if (existente) return { estado: 'YA_EXISTENTE', asientoId: existente.asientoId };

	const apertura = await tx.aperturaPeriodo.findUnique({ where: { periodoId: params.periodoId } });
	if (!apertura) return { estado: 'OMITIDO', motivo: 'SIN_APERTURA' };

	const roles = await tx.cuentaRolTenant.findMany({
		where: { tenantId: params.tenantId },
		include: { cuenta: true },
	});
	if (roles.length === 0) return { estado: 'OMITIDO', motivo: 'PLAN_NO_INICIALIZADO' };
	const rolMapa = new Map(roles.map((r) => [r.rol, r.cuenta.cuentaContableId]));

	const lineas: LineaAsientoResuelta[] = [];
	const push = (rol: string, monto: number, lado: 'DEBE' | 'HABER', referencia: string): void => {
		if (!Number.isFinite(monto) || monto <= 0) return;
		const cuentaId = rolMapa.get(rol);
		if (!cuentaId) return;
		lineas.push(lineaDeLado(cuentaId, monto, lado, lineas.length + 1, referencia));
	};

	push('CAJA_PRINCIPAL', Number(apertura.saldoCajaInicial), 'DEBE', 'Saldo inicial caja');
	push('BANCOS', Number(apertura.saldoBancoInicial), 'DEBE', 'Saldo inicial bancos');
	push('CXC_CLIENTES', Number(apertura.saldoCuentasCobrarInicial), 'DEBE', 'Saldo inicial CxC');
	push('CXP_PROVEEDORES', Number(apertura.saldoCuentasPagarInicial), 'HABER', 'Saldo inicial CxP');
	push('INVENTARIOS', Number(apertura.saldoInventarioInicial), 'DEBE', 'Saldo inicial inventario');
	push('CAPITAL_SOCIAL', Number(apertura.saldoCapitalInicial), 'HABER', 'Saldo inicial capital');
	push(ROL_RESULTADOS_ACUMULADOS, Number(apertura.saldoResultadoAcumInicial), 'HABER', 'Resultados acumulados');

	// Traspaso del resultado del período cerrado (si existe) al acumulado.
	const ultimoCierre = await tx.asiento.findFirst({
		where: { tenantId: params.tenantId, origenTipo: 'cierre_periodo', estado: 'CONTABILIZADO' },
		orderBy: { fecha: 'desc' },
	});
	if (ultimoCierre) {
		const resultadoId = rolMapa.get(ROL_RESULTADO_PERIODO);
		const acumuladoId = rolMapa.get(ROL_RESULTADOS_ACUMULADOS);
		if (resultadoId && acumuladoId) {
			const lineaResultado = await tx.asientoLinea.findFirst({
				where: { asientoId: ultimoCierre.asientoId, cuentaId: resultadoId },
			});
			const monto = lineaResultado
				? Math.max(Number(lineaResultado.debe ?? 0), Number(lineaResultado.haber ?? 0))
				: 0;
			if (monto > 0) {
				push(ROL_RESULTADO_PERIODO, monto, 'DEBE', 'Traspaso del resultado cerrado');
				push(ROL_RESULTADOS_ACUMULADOS, monto, 'HABER', 'Traspaso del resultado cerrado');
			}
		}
	}

	if (lineas.length < 2) return { estado: 'OMITIDO', motivo: 'SIN_SALDOS_DE_APERTURA' };

	const diarioId = await diarioAperturaCierre(tx, params.tenantId);
	if (!diarioId) return { estado: 'OMITIDO', motivo: 'DIARIO_NO_ENCONTRADO' };

	const resultado = await insertarAsientoConNumeracion(
		tx,
		{ tenantId: params.tenantId, userId: params.actorId },
		{
			diarioId,
			periodoId: params.periodoId,
			fecha: params.fecha,
			descripcion: 'Apertura del período',
			origenTipo: 'apertura_periodo',
			origenId: params.periodoId,
			lineas,
			createdBy: params.actorId,
		},
	);
	return resultado.duplicado
		? { estado: 'YA_EXISTENTE', asientoId: resultado.asientoId }
		: { estado: 'CONTABILIZADO', asientoId: resultado.asientoId };
}
