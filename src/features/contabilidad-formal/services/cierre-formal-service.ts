/**
 * @description Asiento de cierre formal del período contable (CTA-3).
 *
 * Cuando un período queda **aprobado**, sus cuentas de resultado (ingreso,
 * costo y gasto) se vacían contra la cuenta de resultado del período
 * (`RESULTADO_PERIODO`): el saldo neto de cada cuenta de resultado se lleva a
 * cero y la utilidad (o la pérdida) del período queda en una sola cuenta.
 *
 * El asiento se construye programáticamente (las plantillas del plan no
 * cubren `CIERRE_PERIODO`) y se identifica con el origen
 * `cierre_periodo:<periodoId>`, de modo que la generación es idempotente: un
 * segundo cierre del mismo período devuelve el asiento existente en lugar de
 * duplicarlo.
 *
 * El servicio respeta el modo global `CONTABILIDAD_FORMAL_MODE`: con la capa
 * apagada (`off`, el valor por defecto) o en observación (`shadow`) no escribe
 * nada y no consulta la base. En modo `enforce` falla cerrado: si el cierre no
 * puede generarse (diario o rol contable ausente, descuadre), la aprobación
 * del período se rechaza en lugar de quedar aprobada sin su cierre.
 *
 * @module src/features/contabilidad-formal/services/cierre-formal-service
 */
import { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';
import { decimalFuncional } from '@/features/contabilidad-formal/services/decimal-contable';
import {
	insertarAsientoConNumeracion,
	modoActual,
	type LineaAsientoResuelta,
} from '@/features/contabilidad-formal/services/posting-engine';

/** Tipos de cuenta que constituyen el resultado del período. */
const TIPOS_RESULTADO = ['INGRESO', 'COSTO', 'GASTO'] as const;

/** Rol contable que recibe el resultado del período. */
const ROL_RESULTADO_PERIODO = 'RESULTADO_PERIODO';

/** Origen idempotente del asiento de cierre: el período contable. */
const ORIGEN_CIERRE = 'cierre_periodo';

/** Cliente Prisma transaccional compartido con el motor. */
export type CierreTx = Prisma.TransactionClient;

/** Parámetros de generación del asiento de cierre. */
export interface ParamsCierreFormal {
	/** Período contable que se cierra. */
	periodoId: string;
	/** Tenant propietario del período. */
	tenantId: string;
	/** Usuario que aprueba el cierre. */
	actorId: string;
	/** Fecha efectiva del cierre; por defecto, hoy. */
	fecha?: Date;
}

/** Resultado normalizado de la generación del cierre formal. */
export interface ResultadoCierreFormal {
	/** Estado de la generación. */
	estado: 'CONTABILIZADO' | 'OMITIDO' | 'YA_EXISTENTE';
	/** Identificador del asiento de cierre, cuando se generó o ya existía. */
	asientoId?: string;
	/** Motivo de la omisión, cuando el asiento no se generó. */
	motivo?: string;
}

/**
 * @description Construye la línea de un lado del asiento con numeración
 * creciente y la evidencia monetaria en moneda funcional.
 * @param {string} cuentaId - Cuenta contable de la línea.
 * @param {Prisma.Decimal | number} monto - Importe funcional de la línea.
 * @param {'DEBE' | 'HABER'} lado - Lado contable de la línea.
 * @param {number} orden - Número de orden de la línea.
 * @param {string} referencia - Referencia legible de la línea.
 * @returns {LineaAsientoResuelta} Línea lista para persistir.
 */
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
 * @description Saldo neto de una cuenta de resultado dentro del período:
 * ingreso → haber − debe; costo o gasto → debe − haber.
 * @param {string} tipo - Tipo contable de la cuenta.
 * @param {{ debe: Prisma.Decimal; haber: Prisma.Decimal }} suma - Acumulado del período.
 * @returns {Prisma.Decimal} Saldo neto con signo contable.
 */
function saldoNeto(
	tipo: string,
	suma: { debe: Prisma.Decimal; haber: Prisma.Decimal },
): Prisma.Decimal {
	return tipo === 'INGRESO' ? suma.haber.minus(suma.debe) : suma.debe.minus(suma.haber);
}

/**
 * @description Genera el asiento de cierre de un período aprobado: vacía las
 * cuentas de resultado del período contra la cuenta de resultado del período.
 *
 * Idempotente por origen `cierre_periodo:<periodoId>`. Con la capa formal
 * apagada o en modo `shadow` no hace nada. En modo `enforce` falla cerrado
 * cuando el cierre no puede construirse.
 *
 * @param {CierreTx} tx - Transacción que aprueba el período.
 * @param {ParamsCierreFormal} params - Período, tenant y actor del cierre.
 * @returns {Promise<ResultadoCierreFormal>} Resultado de la generación.
 */
export async function generarAsientoCierre(
	tx: CierreTx,
	params: ParamsCierreFormal,
): Promise<ResultadoCierreFormal> {
	if (modoActual() !== 'enforce') {
		return { estado: 'OMITIDO', motivo: 'MODO_NO_ENFORCE' };
	}

	const existente = await tx.asiento.findFirst({
		where: {
			tenantId: params.tenantId,
			origenTipo: ORIGEN_CIERRE,
			origenId: params.periodoId,
		},
		select: { asientoId: true },
	});
	if (existente) {
		return { estado: 'YA_EXISTENTE', asientoId: existente.asientoId };
	}

	const periodo = await tx.periodoContable.findUnique({
		where: { periodoId: params.periodoId },
		select: {
			periodoId: true,
			tenantId: true,
			estado: true,
			fechaInicio: true,
			fechaFin: true,
		},
	});
	if (!periodo || periodo.tenantId !== params.tenantId) {
		throw new ActionError('Período de cierre no encontrado', 'NOT_FOUND');
	}
	if (periodo.estado !== 'APROBADO') {
		throw new ActionError(
			'El período debe estar aprobado para generar su cierre formal',
			'TRANSICION_INVALIDA',
		);
	}

	const roles = await tx.cuentaRolTenant.findMany({
		where: { tenantId: params.tenantId, rol: ROL_RESULTADO_PERIODO },
		select: { cuentaId: true },
	});
	const resultadoId = roles[0]?.cuentaId;
	if (!resultadoId) {
		throw new ActionError(
			'Falta el rol contable RESULTADO_PERIODO, necesario para el cierre formal',
			'ROL_CONTABLE_FALTANTE',
		);
	}

	const saldos = await tx.asientoLinea.groupBy({
		by: ['cuentaId'],
		where: {
			asiento: {
				tenantId: params.tenantId,
				periodoId: params.periodoId,
				estado: 'CONTABILIZADO',
			},
			cuenta: { tipo: { in: [...TIPOS_RESULTADO] } },
		},
		_sum: { debe: true, haber: true },
	});

	const cuentas = saldos.length
		? await tx.cuentaContable.findMany({
				where: {
					tenantId: params.tenantId,
					cuentaContableId: { in: saldos.map((saldo) => saldo.cuentaId) },
				},
				select: { cuentaContableId: true, tipo: true },
			})
		: [];
	const tipoPorCuenta = new Map(cuentas.map((cuenta) => [cuenta.cuentaContableId, cuenta.tipo]));

	let neto = new Prisma.Decimal(0);
	const lineas: LineaAsientoResuelta[] = [];
	for (const suma of saldos) {
		const tipo = tipoPorCuenta.get(suma.cuentaId);
		if (!tipo) continue;
		const saldo = saldoNeto(tipo, {
			debe: decimalFuncional(String(suma._sum.debe ?? 0)),
			haber: decimalFuncional(String(suma._sum.haber ?? 0)),
		});
		if (saldo.isZero()) continue;
		// La cuenta de resultado se vacía con el lado contrario a su saldo y la
		// diferencia va al resultado del período.
		const ladoSaldo = tipo === 'INGRESO' ? 'HABER' : 'DEBE';
		const ladoCierre = saldo.gt(0)
			? (ladoSaldo === 'HABER' ? 'DEBE' : 'HABER')
			: ladoSaldo;
		lineas.push(
			lineaDeLado(
				suma.cuentaId,
				saldo.abs(),
				ladoCierre,
				lineas.length + 1,
				'Cierre',
			),
		);
		neto = tipo === 'INGRESO' ? neto.plus(saldo) : neto.minus(saldo);
	}

	if (lineas.length === 0) {
		return { estado: 'OMITIDO', motivo: 'RESULTADO_CERO_SIN_MOVIMIENTOS' };
	}

	// Contrapartida: la utilidad queda en el haber y la pérdida en el debe.
	if (!neto.isZero()) {
		lineas.push(
			lineaDeLado(
				resultadoId,
				neto.abs(),
				neto.gt(0) ? 'HABER' : 'DEBE',
				lineas.length + 1,
				'Resultado del período',
			),
		);
	}

	const debe = lineas.reduce(
		(total, linea) => total.plus(linea.debe),
		new Prisma.Decimal(0),
	);
	const haber = lineas.reduce(
		(total, linea) => total.plus(linea.haber),
		new Prisma.Decimal(0),
	);
	if (!debe.eq(haber)) {
		throw new ActionError(
			'El asiento de cierre formal no cuadra',
			'CIERRE_FORMAL_DESCUADRADO',
		);
	}

	const diario = await tx.diario.findFirst({
		where: { tenantId: params.tenantId, tipo: 'APERTURA_CIERRE', activo: true },
		select: { diarioId: true },
	});
	if (!diario) {
		throw new ActionError(
			'No existe un diario de apertura/cierre activo',
			'DIARIO_NO_ENCONTRADO',
		);
	}

	// El cierre pertenece al período que cierra: si se aprueba con posterioridad
	// a su fin, se fecha el último día del período.
	const hoy = params.fecha ?? new Date();
	const fechaContable =
		hoy < periodo.fechaInicio || hoy > periodo.fechaFin ? periodo.fechaFin : hoy;

	const resultado = await insertarAsientoConNumeracion(
		tx,
		{ tenantId: params.tenantId, userId: params.actorId },
		{
			diarioId: diario.diarioId,
			periodoId: params.periodoId,
			fecha: fechaContable,
			descripcion: 'Cierre del período',
			origenTipo: ORIGEN_CIERRE,
			origenId: params.periodoId,
			lineas,
			createdBy: params.actorId,
		},
	);
	return resultado.duplicado
		? { estado: 'YA_EXISTENTE', asientoId: resultado.asientoId }
		: { estado: 'CONTABILIZADO', asientoId: resultado.asientoId };
}
