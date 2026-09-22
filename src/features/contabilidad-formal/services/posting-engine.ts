/**
 * @description Motor de asientos de la capa de contabilidad formal (CTA-1).
 *
 * Recibe un evento de negocio tipado desde un writer existente (dentro de su
 * transacción Prisma) y materializa el asiento de partida doble:
 *
 *   1. Modo (`CONTABILIDAD_FORMAL_MODE`): off → no-op; shadow → intenta, nunca
 *      lanza, registra en consola; enforce → asienta o rechaza la operación.
 *   2. Idempotencia por origen: (tenantId, origenTipo, origenId) único.
 *   3. Tenant sin plan inicializado (sin CuentaRolTenant) → omite en cualquier
 *      modo: la capa formal solo existe para tenants que activaron la flag.
 *   4. Guard de períodos + resolución del período por fecha (`INTENTO_BYPASS`
 *      queda registrado por el propio guard cuando aplica).
 *   5. Plantilla global del evento + mapeo rol→cuenta del tenant.
 *      Regla de tesorería: si el evento indica medio bancario, el rol
 *      CAJA_PRINCIPAL se sustituye por BANCOS en todas sus líneas.
 *   6. Reglas de monto en MONEDA FUNCIONAL; solo las líneas TOTAL conservan la
 *      valoración original (moneda, monto, tasa, fingerprint FX heredados de la
 *      escritura de negocio — la capa nunca recalcula tasas).
 *   7. Cuadre exacto (Σdebe = Σhaber), numeración por diario+período y hash
 *      SHA256 encadenado por tenant bajo el advisory lock del flujo.
 *
 * @module src/features/contabilidad-formal/services/posting-engine
 */

import { createHash } from 'node:crypto';

import { ActionError } from '@/lib/server-actions';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';
import { PeriodoContableService } from '@/lib/services/periodo-contable-service';
import { withAccountingTenantLock } from '@/features/contabilidad/services/accounting-tenant-lock-service';
import {
	DIARIO_POR_EVENTO,
	type LadoAsientoPlan,
	type ReglaMontoClave,
	type RolCuentaClave,
	type TipoEventoClave,
} from '@/features/contabilidad-formal/lib/plan-default';

/** Modos operativos del motor. */
export type ModoMotorContable = 'off' | 'shadow' | 'enforce';

/** Extra opcional del evento para reglas compuestas (montos en moneda funcional). */
export interface AuxiliaresEvento {
	/** Costo FIFO de la mercadería vendida/devuelta (funcional). */
	costoFifo?: number;
	/** Intereses devengados dentro del total cobrado/pagado (funcional). */
	intereses?: number;
	/** Cobro/pago parcial efectivamente movido (funcional). */
	montoPagado?: number;
	/** Signo económico: > 0 favorable (ingreso cambiario), < 0 pérdida (funcional). */
	diferenciaFx?: number;
}

/** Evento de negocio valorizado, listo para contabilizar. */
export interface EventoContableInput {
	tipo: TipoEventoClave;
	fecha: Date;
	descripcion: string;
	origen: { tipo: string; id: string };
	/** Monto en moneda original (solo referencia y líneas TOTAL). */
	monto: number;
	moneda: string;
	/** Todos los montos contables se derivan de este valor (moneda funcional). */
	montoFuncional: number;
	monedaFuncional: string;
	tasaCambio?: number | null;
	fxEvidenceFingerprint?: string | null;
	/** CAJA (default) o BANCOS: sustituye el rol CAJA_PRINCIPAL por BANCOS. */
	medioCobro?: 'CAJA' | 'BANCOS';
	referencia?: string;
	auxiliares?: AuxiliaresEvento;
}

/** Contexto de ejecución (tenant y actor). */
export interface ContextoPosting {
	tenantId: string;
	userId: string;
}

/** Resultado del motor. */
export interface PostEventoResult {
	estado: 'OMITIDO' | 'CONTABILIZADO' | 'YA_EXISTENTE' | 'ERROR_SHADOW';
	asientoId?: string;
	motivo?: string;
}

interface PlantillaFila {
	orden: number;
	lado: 'DEBE' | 'HABER';
	rolCuenta: string;
	montoRegla: string;
	condicion: string | null;
}

interface RolFila {
	rol: string;
	cuenta: {
		cuentaContableId: string;
		aceptaMovimiento: boolean;
		activa: boolean;
	};
}

/** Subconjunto del tx Prisma que el motor necesita (estructural). */
export interface PostingTx {
	plantillaAsiento: {
		findMany(args: {
			where: { evento: string; activa: boolean };
			orderBy: { orden: 'asc' };
		}): Promise<PlantillaFila[]>;
	};
	cuentaRolTenant: {
		findMany(args: {
			where: { tenantId: string };
			include?: unknown;
		}): Promise<RolFila[]>;
	};
	diario: {
		findFirst(args: {
			where: { tenantId: string; tipo: string; activo: boolean };
		}): Promise<{ diarioId: string } | null>;
	};
	asiento: {
		findUnique(args: unknown): Promise<{ asientoId: string } | null>;
		aggregate(args: {
			_max: { numero: true };
			where: { diarioId: string; periodoId: string };
		}): Promise<{ _max: { numero: number | null } }>;
		findFirst(args: {
			where: { tenantId: string };
			orderBy: Array<Record<string, 'desc'>>;
			select: { hash: true };
		}): Promise<{ hash: string } | null>;
		create(args: { data: Record<string, unknown> }): Promise<{ asientoId: string }>;
	};
}

const EPSILON_CUADRE = 0.005;

/** Redondeo a 4 decimales (paridad con los campos DECIMAL(20,4)). */
function round4(valor: number): number {
	return Math.round(valor * 10000) / 10000;
}

function modoActual(): ModoMotorContable {
	const modo = process.env.CONTABILIDAD_FORMAL_MODE;
	return modo === 'shadow' || modo === 'enforce' ? modo : 'off';
}

function logShadow(mensaje: string, extra?: Record<string, unknown>): void {
	console.warn('[contabilidad-formal][shadow]', mensaje, extra ?? '');
}

/**
 * @description Filtra las líneas de plantilla por condición FX y calcula el
 * monto funcional de cada una según su regla.
 */
function resolverMontos(
	lineas: PlantillaFila[],
	evento: EventoContableInput,
): Array<{ linea: PlantillaFila; monto: number }> {
	const dif = evento.auxiliares?.diferenciaFx ?? 0;
	const activa =
		dif > 0 ? 'FX_POSITIVA' : dif < 0 ? 'FX_NEGATIVA' : 'SIN_DIFERENCIA_FX';

	const resultado: Array<{ linea: PlantillaFila; monto: number }> = [];
	for (const linea of lineas) {
		if (linea.condicion && linea.condicion !== activa) continue;

		let monto: number | null = null;
		switch (linea.montoRegla as ReglaMontoClave) {
			case 'TOTAL':
				monto = evento.montoFuncional;
				break;
			case 'MONTO_PAGADO':
				monto = evento.auxiliares?.montoPagado ?? evento.montoFuncional;
				break;
			case 'COSTO_FIFO':
				monto = evento.auxiliares?.costoFifo ?? null;
				break;
			case 'INTERESES':
				monto = evento.auxiliares?.intereses ?? null;
				break;
			case 'TOTAL_MENOS_INTERESES':
				monto = evento.montoFuncional - (evento.auxiliares?.intereses ?? 0);
				break;
			case 'DIFERENCIA_FX':
				monto = Math.abs(dif);
				break;
			case 'TOTAL_MENOS_DIFERENCIA':
				monto = evento.montoFuncional - Math.abs(dif);
				break;
			case 'TOTAL_MAS_DIFERENCIA':
				monto = evento.montoFuncional + Math.abs(dif);
				break;
		}
		if (monto == null || monto <= 0) continue; // líneas sin monto se omiten
		resultado.push({ linea, monto: round4(monto) });
	}
	return resultado;
}

/**
 * @description Construye y persiste el asiento de un evento de negocio.
 * Debe invocarse DENTRO de la transacción del writer (misma atomicidad).
 * @param {PostingTx} tx - Transacción Prisma activa.
 * @param {ContextoPosting} ctx - Tenant y actor.
 * @param {EventoContableInput} evento - Evento valorizado por la capa caja.
 * @returns {Promise<PostEventoResult>} Estado resultante del posteo.
 */
export async function postEvento(
	tx: PostingTx,
	ctx: ContextoPosting,
	evento: EventoContableInput,
): Promise<PostEventoResult> {
	const modo = modoActual();
	if (modo === 'off') return { estado: 'OMITIDO', motivo: 'MODO_OFF' };

	try {
		return await postEventoInterno(tx, ctx, evento, modo);
	} catch (error) {
		if (modo === 'shadow') {
			logShadow('evento no contabilizado', {
				tipo: evento.tipo,
				origen: `${evento.origen.tipo}:${evento.origen.id}`,
				error: error instanceof Error ? error.message : String(error),
			});
			return { estado: 'ERROR_SHADOW', motivo: error instanceof Error ? error.message : 'error' };
		}
		throw error;
	}
}

async function postEventoInterno(
	tx: PostingTx,
	ctx: ContextoPosting,
	evento: EventoContableInput,
	modo: ModoMotorContable,
): Promise<PostEventoResult> {
	const existente = await tx.asiento.findUnique({
		where: {
			tenantId_origenTipo_origenId: {
				tenantId: ctx.tenantId,
				origenTipo: evento.origen.tipo,
				origenId: evento.origen.id,
			},
		},
	});
	if (existente) {
		return { estado: 'YA_EXISTENTE', asientoId: existente.asientoId };
	}

	const roles = await tx.cuentaRolTenant.findMany({
		where: { tenantId: ctx.tenantId },
		include: {
			cuenta: {
				select: { cuentaContableId: true, aceptaMovimiento: true, activa: true },
			},
		},
	});
	if (roles.length === 0) {
		if (modo === 'shadow') {
			logShadow('tenant sin plan de cuentas inicializado', { tenantId: ctx.tenantId });
		}
		return { estado: 'OMITIDO', motivo: 'PLAN_NO_INICIALIZADO' };
	}

	// Gobernanza: mismo guard que bloquea la escritura de la base caja.
	const validacion = await PeriodoGuard.assertWritable(
		evento.fecha,
		ctx.tenantId,
		'asiento',
	);
	if (!validacion.permitido) {
		throw new ActionError(
			validacion.error ??
				'El período contable está cerrado para esa fecha',
			validacion.codigo ?? 'PERIODO_CERRADO',
		);
	}

	const resolucion = await PeriodoContableService.resolverPeriodoActivo(
		evento.fecha,
		ctx.tenantId,
	);
	if (!resolucion.periodo) {
		throw new ActionError(
			'No existe un período contable para la fecha del asiento',
			'PERIODO_NO_EXISTE',
		);
	}
	const periodoId = resolucion.periodo.periodoId;

	const plantilla = await tx.plantillaAsiento.findMany({
		where: { evento: evento.tipo, activa: true },
		orderBy: { orden: 'asc' },
	});
	if (plantilla.length === 0) {
		throw new ActionError(
			`No hay plantilla activa para el evento ${evento.tipo}`,
			'PLANTILLA_NO_ENCONTRADA',
		);
	}

	const rolACuenta = new Map(
		roles.map((fila) => [fila.rol as RolCuentaClave, fila.cuenta]),
	);
	const lineasResueltas = resolverMontos(plantilla, evento);
	if (lineasResueltas.length < 2) {
		throw new ActionError(
			`La plantilla de ${evento.tipo} no produjo al menos dos líneas con monto`,
			'PLANTILLA_VACIA',
		);
	}

	const esBanco = evento.medioCobro === 'BANCOS';
	const lineas = lineasResueltas.map(({ linea, monto }, index) => {
		const rol = (esBanco && linea.rolCuenta === 'CAJA_PRINCIPAL'
			? 'BANCOS'
			: linea.rolCuenta) as RolCuentaClave;
		const cuenta = rolACuenta.get(rol);
		if (!cuenta) {
			throw new ActionError(
				`Falta asignar la cuenta para ${rol} en Configuración contable`,
				'CUENTA_SIN_MAPEAR',
			);
		}
		if (!cuenta.aceptaMovimiento || !cuenta.activa) {
			throw new ActionError(
				`La cuenta asignada al rol ${rol} no admite movimientos o está inactiva`,
				'CUENTA_NO_MOVIDA',
			);
		}
		// Solo TOTAL conserva la valoración original; el resto es funcional puro.
		const esTotal = linea.montoRegla === 'TOTAL';
		return {
			orden: index + 1,
			cuentaId: cuenta.cuentaContableId,
			debe: linea.lado === 'DEBE' ? monto : 0,
			haber: linea.lado === 'HABER' ? monto : 0,
			monedaOriginal: esTotal ? evento.moneda : evento.monedaFuncional,
			montoOriginal: esTotal ? round4(Number(evento.monto)) : monto,
			tasaCambio: esTotal ? (evento.tasaCambio ?? null) : null,
			fxEvidenceFingerprint: esTotal ? (evento.fxEvidenceFingerprint ?? null) : null,
			referencia: evento.referencia ?? null,
		};
	});

	const totalDebe = round4(lineas.reduce((acc, l) => acc + l.debe, 0));
	const totalHaber = round4(lineas.reduce((acc, l) => acc + l.haber, 0));
	if (Math.abs(totalDebe - totalHaber) > EPSILON_CUADRE) {
		throw new ActionError(
			`El asiento no cuadra: debe y haber difieren (${totalDebe} vs ${totalHaber})`,
			'ASIENTO_DESCUADRADO',
		);
	}

	const tipoDiario = DIARIO_POR_EVENTO[evento.tipo as TipoEventoClave];
	const diario = await tx.diario.findFirst({
		where: { tenantId: ctx.tenantId, tipo: tipoDiario, activo: true },
	});
	if (!diario) {
		throw new ActionError(
			`No existe un diario activo de tipo ${tipoDiario} para este tenant`,
			'DIARIO_NO_ENCONTRADO',
		);
	}

	const resultado = await withAccountingTenantLock(tx as Parameters<typeof withAccountingTenantLock>[0], ctx.tenantId, async () => {
		const agregado = await tx.asiento.aggregate({
			_max: { numero: true },
			where: { diarioId: diario.diarioId, periodoId },
		});
		const numero = (agregado._max.numero ?? 0) + 1;

		const ultimo = await tx.asiento.findFirst({
			where: { tenantId: ctx.tenantId },
			orderBy: [{ createdAt: 'desc' }, { asientoId: 'desc' }],
			select: { hash: true },
		});
		const hashAnterior = ultimo?.hash ?? null;

		const canonico = JSON.stringify({
			tenantId: ctx.tenantId,
			diarioId: diario.diarioId,
			periodoId,
			numero,
			fecha: evento.fecha.toISOString(),
			origenTipo: evento.origen.tipo,
			origenId: evento.origen.id,
			lineas: lineas.map((l) => ({
				orden: l.orden,
				cuentaId: l.cuentaId,
				debe: l.debe,
				haber: l.haber,
			})),
			hashAnterior,
		});
		const hash = createHash('sha256').update(canonico).digest('hex');

		try {
			const creado = await tx.asiento.create({
				data: {
					tenantId: ctx.tenantId,
					diarioId: diario.diarioId,
					periodoId,
					numero,
					fecha: evento.fecha,
					descripcion: evento.descripcion,
					estado: 'CONTABILIZADO',
					origenTipo: evento.origen.tipo,
					origenId: evento.origen.id,
					hash,
					hashAnterior,
					createdBy: ctx.userId,
					lineas: { create: lineas },
				},
			});
			return { asientoId: creado.asientoId, duplicado: false };
		} catch (error) {
			// Doble posteo concurrente del mismo origen: la unicidad lo resuelve — leer
			// el asiento ganador y tratarlo como YA_EXISTENTE (retry-safe).
			if (
				typeof error === 'object' &&
				error !== null &&
				(error as { code?: string }).code === 'P2002'
			) {
				const previo = await tx.asiento.findUnique({
					where: {
						tenantId_origenTipo_origenId: {
							tenantId: ctx.tenantId,
							origenTipo: evento.origen.tipo,
							origenId: evento.origen.id,
						},
					},
				});
				if (previo) return { asientoId: previo.asientoId, duplicado: true };
			}
			throw error;
		}
	});

	return resultado.duplicado
		? { estado: 'YA_EXISTENTE', asientoId: resultado.asientoId }
		: { estado: 'CONTABILIZADO', asientoId: resultado.asientoId };
}
