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
import { Prisma } from '@/generated/prisma';
import { decimalFuncional } from '@/features/contabilidad-formal/services/decimal-contable';
import {
	insertarAsientoConNumeracion,
	type LineaAsientoResuelta,
} from '@/features/contabilidad-formal/services/posting-engine';

/** Tipos de cuenta que constituyen el resultado (ingreso, costo y gasto). */
const TIPOS_RESULTADO = ['INGRESO', 'COSTO', 'GASTO'] as const;

/** Roles que gobiernan los asientos de cierre/apertura. */
const ROL_RESULTADO_PERIODO = 'RESULTADO_PERIODO';
const ROL_RESULTADOS_ACUMULADOS = 'RESULTADOS_ACUMULADOS';
const ROLES_APERTURA = [
	'CAJA_PRINCIPAL', 'BANCOS', 'CXC_CLIENTES', 'CXP_PROVEEDORES', 'INVENTARIOS',
	'CAPITAL_SOCIAL', ROL_RESULTADO_PERIODO, ROL_RESULTADOS_ACUMULADOS,
] as const;

/** Cliente Prisma transaccional compartido con el motor. */
export type CierreTx = Prisma.TransactionClient;

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

/**
 * @description Compara períodos por día civil UTC, sin depender de si el fin
 * fue persistido a medianoche o al último instante del día.
 */
export function isImmediatelyPrecedingPeriod(priorEnd: Date, currentStart: Date): boolean {
	if (!Number.isFinite(priorEnd.getTime()) || !Number.isFinite(currentStart.getTime())) return false;
	const priorCivilDay = Date.UTC(
		priorEnd.getUTCFullYear(), priorEnd.getUTCMonth(), priorEnd.getUTCDate(),
	);
	const currentCivilDay = Date.UTC(
		currentStart.getUTCFullYear(), currentStart.getUTCMonth(), currentStart.getUTCDate(),
	);
	return currentCivilDay - priorCivilDay === 24 * 60 * 60 * 1000;
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
	monto: Prisma.Decimal | number,
	lado: 'DEBE' | 'HABER',
	orden: number,
	referencia: string,
): LineaAsientoResuelta {
	const valor = decimalFuncional(String(monto));
	return {
		orden,
		cuentaId,
		debe: lado === 'DEBE' ? valor : new Prisma.Decimal(0),
		haber: lado === 'HABER' ? valor : new Prisma.Decimal(0),
		monedaOriginal: 'CUP',
		montoOriginal: valor,
		tasaCambio: null,
		fxEvidenceFingerprint: null,
		referencia,
	};
}

/**
 * @description Saldo neto de una cuenta de resultado dentro del período.
 * INGRESO → haber − debe; COSTO/GASTO → debe − haber.
 */
function saldoNeto(tipo: string, suma: { debe: Prisma.Decimal; haber: Prisma.Decimal }): Prisma.Decimal {
	return tipo === 'INGRESO' ? suma.haber.minus(suma.debe) : suma.debe.minus(suma.haber);
}

/** Obtiene el resultado de actividad del período, excluyendo asientos de cierre. */
async function resultadoOperativoPeriodo(
	tx: CierreTx,
	tenantId: string,
	periodoId: string,
): Promise<Prisma.Decimal> {
	const saldos = await tx.asientoLinea.groupBy({
		by: ['cuentaId'],
		where: {
			asiento: { tenantId, periodoId, estado: 'CONTABILIZADO', origenTipo: { not: 'cierre_periodo' } },
			cuenta: { tipo: { in: [...TIPOS_RESULTADO] } },
		},
		_sum: { debe: true, haber: true },
	});
	if (saldos.length === 0) return new Prisma.Decimal(0);
	const cuentas = await tx.cuentaContable.findMany({
		where: { cuentaContableId: { in: saldos.map((saldo) => saldo.cuentaId) } },
		select: { cuentaContableId: true, tipo: true },
	});
	const tipoPorCuenta = new Map(cuentas.map((cuenta) => [cuenta.cuentaContableId, cuenta.tipo]));
	return saldos.reduce((neto, suma) => {
		const tipo = tipoPorCuenta.get(suma.cuentaId);
		if (!tipo) throw new Error(`Falta el tipo contable de ${suma.cuentaId}`);
		return tipo === 'INGRESO'
			? neto.plus(saldoNeto(tipo, {
				debe: decimalFuncional(String(suma._sum.debe ?? 0)),
				haber: decimalFuncional(String(suma._sum.haber ?? 0)),
			}))
			: neto.minus(saldoNeto(tipo, {
				debe: decimalFuncional(String(suma._sum.debe ?? 0)),
				haber: decimalFuncional(String(suma._sum.haber ?? 0)),
			}));
	}, new Prisma.Decimal(0));
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
	const periodo = await tx.periodoContable.findUnique({ where: { periodoId: params.periodoId } });
	if (!periodo || periodo.tenantId !== params.tenantId) throw new Error('Período de cierre no encontrado');
	const fecha = params.fecha ?? new Date();
	const fechaContable = fecha < periodo.fechaInicio || fecha > periodo.fechaFin ? periodo.fechaFin : fecha;

	const roles = await tx.cuentaRolTenant.findMany({
		where: { tenantId: params.tenantId },
		include: { cuenta: true },
	});
	if (roles.length === 0) throw new Error('Faltan roles contables requeridos para el cierre');
	const rolMapa = new Map(roles.map((r) => [r.rol, r.cuenta.cuentaContableId]));
	const resultadoId = rolMapa.get(ROL_RESULTADO_PERIODO);
	if (!resultadoId) throw new Error('Falta el rol contable RESULTADO_PERIODO');

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

	let neto = new Prisma.Decimal(0);
	const lineas: LineaAsientoResuelta[] = [];
	let orden = 0;
	for (const suma of saldos) {
		const tipo = tipoPorCuenta.get(suma.cuentaId);
		if (!tipo) continue;
		const saldo = saldoNeto(tipo, {
			debe: decimalFuncional(String(suma._sum.debe ?? 0)),
			haber: decimalFuncional(String(suma._sum.haber ?? 0)),
		});
		if (saldo.isZero()) continue;
		orden += 1;
		const ladoSaldo = tipo === 'INGRESO' ? 'HABER' : 'DEBE';
		lineas.push(lineaDeLado(suma.cuentaId, saldo.abs(),
			saldo.gt(0) ? (ladoSaldo === 'HABER' ? 'DEBE' : 'HABER') : ladoSaldo,
			orden, 'Cierre'));
		neto = tipo === 'INGRESO' ? neto.plus(saldo) : neto.minus(saldo);
	}

	if (lineas.length === 0) return { estado: 'OMITIDO', motivo: 'RESULTADO_CERO_SIN_MOVIMIENTOS' };

	// Contrapartida: utilidad al haber del resultado; pérdida al debe.
	orden += 1;
	if (!neto.isZero()) lineas.push(lineaDeLado(resultadoId, neto.abs(),
		neto.gt(0) ? 'HABER' : 'DEBE', orden, 'Resultado del período'));
	const debe = lineas.reduce((total, linea) => total.plus(linea.debe), new Prisma.Decimal(0));
	const haber = lineas.reduce((total, linea) => total.plus(linea.haber), new Prisma.Decimal(0));
	if (!debe.eq(haber)) throw new Error('El asiento de cierre no cuadra');

	const diarioId = await diarioAperturaCierre(tx, params.tenantId);
	if (!diarioId) return { estado: 'OMITIDO', motivo: 'DIARIO_NO_ENCONTRADO' };

	const resultado = await insertarAsientoConNumeracion(
		tx,
		{ tenantId: params.tenantId, userId: params.actorId },
		{
			diarioId,
			periodoId: params.periodoId,
			fecha: fechaContable,
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

	const apertura = await tx.aperturaPeriodo.findFirst({ where: { periodoId: params.periodoId, tenantId: params.tenantId } });
	if (!apertura) return { estado: 'OMITIDO', motivo: 'SIN_APERTURA' };
	if (apertura.tenantId !== params.tenantId) throw new Error('La apertura pertenece a otro tenant');
	const periodo = await tx.periodoContable.findUnique({ where: { periodoId: params.periodoId } });
	if (!periodo || periodo.tenantId !== params.tenantId) throw new Error('Período de apertura no encontrado');
	if (params.fecha < periodo.fechaInicio || params.fecha > periodo.fechaFin) {
		throw new Error('La fecha de apertura está fuera del período');
	}
	const periodosSolapados = await tx.periodoContable.findMany({
		where: {
			tenantId: params.tenantId,
			tipo: periodo.tipo,
			periodoId: { not: periodo.periodoId },
			fechaInicio: { lte: periodo.fechaFin },
			fechaFin: { gte: periodo.fechaInicio },
		},
		select: { periodoId: true },
		take: 1,
	});
	if (periodosSolapados.length > 0) throw new Error('Existe un período contable solapado');
	const periodoAnterior = await tx.periodoContable.findFirst({
		where: { tenantId: params.tenantId, fechaFin: { lt: periodo.fechaInicio }, tipo: periodo.tipo },
		orderBy: { fechaFin: 'desc' },
	});
	if (!periodoAnterior || !isImmediatelyPrecedingPeriod(periodoAnterior.fechaFin, periodo.fechaInicio) || periodoAnterior.estado !== 'APROBADO') {
		throw new Error('No existe un período anterior contiguo aprobado');
	}
	// Although the schema allows null for initial openings, this formal rollover
	// path only accepts an opening explicitly derived from its immediate predecessor.
	if (apertura.origenPeriodoId !== periodoAnterior.periodoId) {
		throw new Error('La apertura no corresponde al período inmediatamente anterior');
	}

	const roles = await tx.cuentaRolTenant.findMany({
		where: { tenantId: params.tenantId },
		include: { cuenta: true },
	});
	if (roles.length === 0) throw new Error('Faltan roles contables requeridos para la apertura');
	const rolMapa = new Map(roles.map((r) => [r.rol, r.cuenta.cuentaContableId]));
	const rolesConfigurados = new Set(roles.map((r) => String(r.rol)));
	const faltante = ROLES_APERTURA.find((rol) => !rolesConfigurados.has(rol));
	if (faltante) throw new Error(`Falta el rol contable ${faltante}`);

	const lineas: LineaAsientoResuelta[] = [];
	const push = (rol: keyof typeof import('@/generated/prisma').RolCuenta, monto: Prisma.Decimal, lado: 'DEBE' | 'HABER', referencia: string): void => {
		if (monto.isZero()) return;
		const cuentaId = rolMapa.get(rol);
		if (!cuentaId) throw new Error(`Falta el rol contable ${rol}`);
		lineas.push(lineaDeLado(cuentaId, monto.abs(), monto.gt(0) ? lado : lado === 'DEBE' ? 'HABER' : 'DEBE', lineas.length + 1, referencia));
	};

	push('CAJA_PRINCIPAL', decimalFuncional(String(apertura.saldoCajaInicial)), 'DEBE', 'Saldo inicial caja');
	push('BANCOS', decimalFuncional(String(apertura.saldoBancoInicial)), 'DEBE', 'Saldo inicial bancos');
	push('CXC_CLIENTES', decimalFuncional(String(apertura.saldoCuentasCobrarInicial)), 'DEBE', 'Saldo inicial CxC');
	push('CXP_PROVEEDORES', decimalFuncional(String(apertura.saldoCuentasPagarInicial)), 'HABER', 'Saldo inicial CxP');
	push('INVENTARIOS', decimalFuncional(String(apertura.saldoInventarioInicial)), 'DEBE', 'Saldo inicial inventario');
	push('CAPITAL_SOCIAL', decimalFuncional(String(apertura.saldoCapitalInicial)), 'HABER', 'Saldo inicial capital');
	// The stored accumulated balance is prior retained earnings; this period's
	// result is transferred separately below, exactly once via the opening source.
	push(ROL_RESULTADOS_ACUMULADOS, decimalFuncional(String(apertura.saldoResultadoAcumInicial)), 'HABER', 'Resultados acumulados');

	// Traspaso del resultado del período cerrado (si existe) al acumulado.
	const ultimoCierre = await tx.asiento.findFirst({
		where: { tenantId: params.tenantId, periodoId: periodoAnterior.periodoId,
			origenTipo: 'cierre_periodo', estado: 'CONTABILIZADO' },
	});
	const resultadoOperativo = await resultadoOperativoPeriodo(tx, params.tenantId, periodoAnterior.periodoId);
	if (!ultimoCierre && !resultadoOperativo.isZero()) {
		throw new Error('Falta el cierre del período inmediatamente anterior');
	}
	const resultadoId = rolMapa.get(ROL_RESULTADO_PERIODO);
	const acumuladoId = rolMapa.get(ROL_RESULTADOS_ACUMULADOS);
	if (!resultadoId || !acumuladoId) throw new Error('Faltan roles para transferir el resultado cerrado');
	const lineasCierre = ultimoCierre
		? await tx.asientoLinea.findMany({ where: { asientoId: ultimoCierre.asientoId } })
		: [];
	if (ultimoCierre) {
		if (lineasCierre.length < 2) throw new Error('El asiento de cierre está incompleto');
		const debeCierre = lineasCierre.reduce(
			(total, linea) => total.plus(decimalFuncional(String(linea.debe ?? 0))), new Prisma.Decimal(0),
		);
		const haberCierre = lineasCierre.reduce(
			(total, linea) => total.plus(decimalFuncional(String(linea.haber ?? 0))), new Prisma.Decimal(0),
		);
		if (!debeCierre.eq(haberCierre)) throw new Error('El asiento de cierre anterior no cuadra');
	}
	const lineasResultado = lineasCierre.filter((linea) => linea.cuentaId === resultadoId);
	if (resultadoOperativo.isZero()) {
		if (lineasResultado.some((linea) =>
			!decimalFuncional(String(linea.debe ?? 0)).isZero() ||
			!decimalFuncional(String(linea.haber ?? 0)).isZero())) {
			throw new Error('El cierre registra resultado no cero cuando el resultado operativo es cero');
		}
		if (lineasResultado.length > 1) throw new Error('El cierre duplica la línea de resultado');
	} else if (lineasResultado.length !== 1) {
		throw new Error('El cierre debe contener exactamente una línea de resultado');
	}
	if (lineasResultado.length === 1) {
		const lineaResultado = lineasResultado[0];
		const debeResultado = decimalFuncional(String(lineaResultado.debe ?? 0));
		const haberResultado = decimalFuncional(String(lineaResultado.haber ?? 0));
		if (!debeResultado.isZero() && !haberResultado.isZero()) throw new Error('Línea de resultado de cierre inválida');
		const magnitudEsperada = resultadoOperativo.abs();
		const ladoEsperadoValido = resultadoOperativo.gt(0)
			? debeResultado.isZero() && haberResultado.eq(magnitudEsperada)
			: resultadoOperativo.lt(0)
				? haberResultado.isZero() && debeResultado.eq(magnitudEsperada)
				: debeResultado.isZero() && haberResultado.isZero();
		if (!ladoEsperadoValido) throw new Error('El cierre no coincide con el resultado operativo verificado');
		if (magnitudEsperada.gt(0)) {
			const ladoResultado: 'DEBE' | 'HABER' = resultadoOperativo.gt(0) ? 'DEBE' : 'HABER';
			push(ROL_RESULTADO_PERIODO, magnitudEsperada, ladoResultado, 'Traspaso del resultado cerrado');
			push(ROL_RESULTADOS_ACUMULADOS, magnitudEsperada,
				ladoResultado === 'DEBE' ? 'HABER' : 'DEBE', 'Traspaso del resultado cerrado');
		}
	}
	const debeTotal = lineas.reduce((total, linea) => total.plus(linea.debe), new Prisma.Decimal(0));
	const haberTotal = lineas.reduce((total, linea) => total.plus(linea.haber), new Prisma.Decimal(0));
	if (!debeTotal.eq(haberTotal)) throw new Error('El asiento de apertura no cuadra');

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
