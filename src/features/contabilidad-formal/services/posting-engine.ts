/**
 * @description Motor de asientos de la capa de contabilidad formal (CTA-1).
 *
 * Recibe un evento de negocio tipado desde un writer existente (dentro de su
 * transacción Prisma) y materializa el asiento de partida doble:
 *
 *   1. Modo (`CONTABILIDAD_FORMAL_MODE`): off → no-op; shadow → simula sin
 *      escribir y registra errores; enforce → asienta o rechaza la operación.
 *   2. Idempotencia por origen: (tenantId, origenTipo, origenId) único.
 *   3. Licencia/flag del tenant verificada en servidor; plan faltante con flag
 *      activo rechaza en enforce y se registra sin afectar caja en shadow.
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
import { assertReplayPostingCapability } from '@/features/contabilidad-formal/services/replay-posting-capability';
import { Prisma } from '@/generated/prisma';
import { resolveEffectivePlanFeatures } from '@/lib/plan-features';
import { decimalFuncional } from '@/features/contabilidad-formal/services/decimal-contable';
import { intentarPosteoShadow } from '@/features/contabilidad-formal/services/shadow-savepoint';
import { registrarResultadoShadow } from '@/features/contabilidad-formal/services/shadow-outbox';

import { ActionError } from '@/lib/server-actions';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';
import { PeriodoContableService } from '@/lib/services/periodo-contable-service';
import { withAccountingTenantLock } from '@/features/contabilidad/services/accounting-tenant-lock-service';
import { validateHashChain } from '@/features/contabilidad-formal/services/hash-chain-integrity';
import {
	DIARIO_POR_EVENTO,
	type LadoAsientoPlan,
	type ReglaMontoClave,
	type RolCuentaClave,
	type TipoEventoClave,
} from '@/features/contabilidad-formal/lib/plan-default';

/** Modos operativos del motor. */
export type ModoMotorContable = 'off' | 'shadow' | 'enforce';

/** Valores decimales aceptados como evidencia sin forzar conversión a IEEE-754. */
export type DecimalInput = Prisma.Decimal | string | number;

/** Límites físicos de precisión definidos para las columnas Decimal del asiento. */
export interface DecimalStorageLimit {
	precision: number;
	scale: number;
}

export const ASIENTO_LINEA_MONTO_LIMIT: DecimalStorageLimit = { precision: 20, scale: 4 };
export const ASIENTO_LINEA_TASA_LIMIT: DecimalStorageLimit = { precision: 20, scale: 10 };

/** Extra opcional del evento para reglas compuestas (montos en moneda funcional). */
export interface AuxiliaresEvento {
	/** Costo FIFO de la mercadería vendida/devuelta (funcional). */
	costoFifo?: DecimalInput;
	/** Intereses devengados dentro del total cobrado/pagado (funcional). */
	intereses?: DecimalInput;
	/** Cobro/pago parcial efectivamente movido (funcional). */
	montoPagado?: DecimalInput;
	/** Signo económico: > 0 favorable (ingreso cambiario), < 0 pérdida (funcional). */
	diferenciaFx?: DecimalInput;
}

/** Evento de negocio valorizado, listo para contabilizar. */
export interface EventoContableInput {
	tipo: TipoEventoClave;
	fecha: Date;
	descripcion: string;
	origen: { tipo: string; id: string };
	/** Monto en moneda original (solo referencia y líneas TOTAL). */
	monto: DecimalInput;
	moneda: string | null;
	/** Todos los montos contables se derivan de este valor (moneda funcional). */
	montoFuncional: DecimalInput | null;
	monedaFuncional: string | null;
	tasaCambio?: DecimalInput | null;
	fxEvidenceFingerprint?: string | null;
	/** CAJA (default) o BANCOS: sustituye el rol CAJA_PRINCIPAL por BANCOS. */
	medioCobro?: 'CAJA' | 'BANCOS';
	referencia?: string;
	auxiliares?: AuxiliaresEvento;
}

type EventoContableValorizado = EventoContableInput & {
	moneda: string;
	montoFuncional: DecimalInput;
	monedaFuncional: string;
};

/** Contexto de ejecución (tenant y actor). */
export interface ContextoPosting {
	tenantId: string;
	userId: string;
}

/** Resultado del motor. */
export interface PostEventoResult {
	estado: 'OMITIDO' | 'SIMULADO' | 'CONTABILIZADO' | 'YA_EXISTENTE' | 'ERROR_SHADOW';
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

/** Cliente Prisma real recibido de la transacción del writer. */
export type PostingTx = Prisma.TransactionClient;

/**
 * @description Serializes finite decimal input to non-exponent plain text without rounding.
 * Rejects JS numbers outside their safe integer range before their lost digits can persist.
 * @param {DecimalInput} value - Source decimal evidence.
 * @param {string} field - Field name used in validation errors.
 * @returns {string} Canonical plain decimal text.
 */
export function serializarDecimalEntrada(
	value: DecimalInput,
	field = 'decimal',
	storageLimit?: DecimalStorageLimit,
): string {
	if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)) {
		throw new TypeError(`${field}_NUMERO_INSEGURO`);
	}
	const sourceText = String(value);
	const exponentText = /[eE]([+-]?\d+)$/.exec(sourceText)?.[1];
	if (exponentText !== undefined) {
		const exponent = Number(exponentText);
		if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000) {
			throw new TypeError(`${field}_EXPONENTE_INVALIDO`);
		}
	}
	let decimal: Prisma.Decimal;
	try {
		decimal = new Prisma.Decimal(sourceText);
	} catch {
		throw new TypeError(`${field}_DECIMAL_INVALIDO`);
	}
	if (!decimal.isFinite()) throw new TypeError(`${field}_DECIMAL_INVALIDO`);
	const canonical = decimal.toFixed();
	if (storageLimit) {
		const unsigned = canonical.startsWith('-') ? canonical.slice(1) : canonical;
		const [integerPart, fractionalPart = ''] = unsigned.split('.');
		const integerDigits = integerPart.replace(/^0+/, '').length;
		if (
			integerDigits > storageLimit.precision - storageLimit.scale ||
			fractionalPart.length > storageLimit.scale
		) {
			throw new TypeError(`${field}_RANGO_DECIMAL_INVALIDO`);
		}
	}
	return canonical;
}

/** @description Convierte sin redondear y valida la escala funcional. */
function funcional(valor: DecimalInput): Prisma.Decimal {
	const serializado = serializarDecimalEntrada(valor, 'MONTO_FUNCIONAL');
	const decimal = decimalFuncional(serializado);
	serializarDecimalEntrada(decimal, 'MONTO_FUNCIONAL', ASIENTO_LINEA_MONTO_LIMIT);
	return decimal;
}

function modoActual(): ModoMotorContable {
	const modo = process.env.CONTABILIDAD_FORMAL_MODE;
	return modo === 'shadow' || modo === 'enforce' ? modo : 'off';
}

function logShadow(mensaje: string, extra?: Record<string, unknown>): void {
	console.warn('[contabilidad-formal][shadow]', mensaje, extra ?? '');
}

/** @description Valida evidencia monetaria antes de cualquier escritura formal. */
function validarEventoMonetario(evento: EventoContableInput): asserts evento is EventoContableValorizado {
	if (
		evento.moneda == null || evento.moneda.trim() === '' ||
		evento.montoFuncional == null ||
		evento.monedaFuncional == null || evento.monedaFuncional.trim() === ''
	) {
		throw new ActionError(
			'La valoración monetaria del evento no está disponible',
			'VALORACION_MONETARIA_AUSENTE',
		);
	}

	let montoOriginal: Prisma.Decimal;
	try {
		montoOriginal = new Prisma.Decimal(serializarDecimalEntrada(
			evento.monto,
			'MONTO_ORIGINAL',
			ASIENTO_LINEA_MONTO_LIMIT,
		));
	} catch {
		throw new ActionError('El monto original no es verificable', 'MONTO_ORIGINAL_INVALIDO');
	}
	if (!montoOriginal.gt(0)) {
		throw new ActionError('El monto original debe ser mayor que cero', 'MONTO_ORIGINAL_INVALIDO');
	}
	if (
		evento.moneda.toUpperCase() !== evento.monedaFuncional.toUpperCase() &&
		(evento.tasaCambio == null || !evento.fxEvidenceFingerprint?.trim())
	) {
		throw new ActionError(
			'La valoración entre monedas requiere tasa y fingerprint de origen',
			'VALORACION_FX_INCOMPLETA',
		);
	}
	if (evento.tasaCambio != null) {
		try {
			const tasa = new Prisma.Decimal(serializarDecimalEntrada(
				evento.tasaCambio,
				'TASA_CAMBIO',
				ASIENTO_LINEA_TASA_LIMIT,
			));
			if (!tasa.gt(0)) throw new Error('TASA_CAMBIO_INVALIDA');
		} catch {
			throw new ActionError('La tasa de cambio no es verificable', 'TASA_CAMBIO_INVALIDA');
		}
	}
	if (!funcional(evento.montoFuncional).gt(0)) {
		throw new ActionError('El monto funcional debe ser mayor que cero', 'MONTO_FUNCIONAL_INVALIDO');
	}
	for (const valor of Object.values(evento.auxiliares ?? {})) {
		if (valor != null) funcional(valor);
	}
}

/**
 * @description Verifica que la moneda funcional del evento coincida con la política
 * contable del tenant. Guard contra defaults silenciosos (p. ej. builders que asumen
 * CUP): un evento con funcional distinta a la del tenant se rechaza; en enforce como
 * error y en shadow como resultado registrado. Sin política o sin moneda funcional
 * configurada también se rechaza (fail-closed): ningún asiento formal se postea sin
 * moneda funcional verificada.
 * @param {PostingTx} tx - Transacción activa.
 * @param {string} tenantId - Tenant propietario.
 * @param {EventoContableValorizado} evento - Evento ya validado monetariamente.
 */
async function validarMonedaFuncionalTenant(
	tx: PostingTx,
	tenantId: string,
	evento: EventoContableValorizado,
): Promise<void> {
	const policy = await tx.tenantAccountingPolicy.findUnique({
		where: { tenantId },
		select: { functionalCurrencyCode: true },
	});
	const funcionalTenant = policy?.functionalCurrencyCode?.trim().toUpperCase();
	if (!funcionalTenant) {
		throw new ActionError(
			'El tenant no tiene moneda funcional configurada en su política contable',
			'MONEDA_FUNCIONAL_INCONSISTENTE',
		);
	}
	if (evento.monedaFuncional.trim().toUpperCase() !== funcionalTenant) {
		throw new ActionError(
			`La moneda funcional del evento (${evento.monedaFuncional}) no coincide con la política contable del tenant (${funcionalTenant})`,
			'MONEDA_FUNCIONAL_INCONSISTENTE',
		);
	}
}

/** Línea de asiento ya resuelta (cuenta y montos definidos). */
export interface LineaAsientoResuelta {
	orden: number;
	cuentaId: string;
	debe: Prisma.Decimal;
	haber: Prisma.Decimal;
	monedaOriginal: string;
	montoOriginal: Prisma.Decimal;
	tasaCambio: Prisma.Decimal | null;
	fxEvidenceFingerprint: string | null;
	referencia: string | null;
}

/** Datos canónicos de un asiento para el hash de integridad. */
export interface HashAsientoInput {
	tenantId: string;
	diarioId: string;
	periodoId: string;
	numero: number;
	fecha: Date;
	origenTipo: string;
	origenId: string;
	lineas: Array<{ orden: number; cuentaId: string; debe: DecimalInput; haber: DecimalInput }>;
	hashAnterior: string | null;
}

/**
 * @description Hash SHA256 de la representación canónica del asiento.
 * Usado por el motor (al crear) y por el verificador forense (al auditar).
 * @param {HashAsientoInput} input - Contenido canónico del asiento.
 * @returns {string} Hash hexadecimal de 64 caracteres.
 */
export function construirHashAsiento(input: HashAsientoInput): string {
	const canonico = JSON.stringify({
		tenantId: input.tenantId,
		diarioId: input.diarioId,
		periodoId: input.periodoId,
		numero: input.numero,
		fecha: input.fecha.toISOString(),
		origenTipo: input.origenTipo,
		origenId: input.origenId,
		lineas: input.lineas.map((l) => ({
			orden: l.orden,
			cuentaId: l.cuentaId,
			debe: l.debe,
			haber: l.haber,
		})),
		hashAnterior: input.hashAnterior,
	});
	return createHash('sha256').update(canonico).digest('hex');
}

/** Versioned v2 serializer. Unlike the historical v1 contract, decimal amounts
 * are normalized strings and the tenant sequence is part of the digest. */
export function construirHashAsientoV2(
	input: HashAsientoInput & { tenantSequence: bigint },
): string {
	const canonico = JSON.stringify({
		hashVersion: 'canonical-v2',
		tenantSequence: input.tenantSequence.toString(),
		tenantId: input.tenantId,
		diarioId: input.diarioId,
		periodoId: input.periodoId,
		numero: input.numero,
		fecha: input.fecha.toISOString(),
		origenTipo: input.origenTipo,
		origenId: input.origenId,
		lineas: input.lineas.map((linea) => ({
			orden: linea.orden,
			cuentaId: linea.cuentaId,
			debe: String(linea.debe),
			haber: String(linea.haber),
		})),
		hashAnterior: input.hashAnterior,
	});
	return createHash('sha256').update(canonico).digest('hex');
}

/** Resultado de la inserción con numeración y cadena. */
export interface ResultadoInsertarAsiento {
	asientoId: string;
	duplicado: boolean;
}

/** Datos completos para insertar un asiento (líneas ya cuadradas y resueltas). */
export interface InsertarAsientoInput {
	diarioId: string;
	periodoId: string;
	fecha: Date;
	descripcion: string;
	origenTipo: string;
	origenId: string;
	lineas: LineaAsientoResuelta[];
	createdBy: string;
}

/**
 * @description Inserta el asiento bajo el advisory lock del tenant: asigna el
 * consecutivo del diario+período, encadena el hash del asiento previo y lo
 * persiste. Un conflicto concurrente de origen se propaga al límite de
 * transacción; el caller puede reintentar la operación completa en una nueva
 * transacción para volver a observar al ganador.
 * @param {PostingTx} tx - Transacción activa.
 * @param {ContextoPosting} ctx - Tenant y actor.
 * @param {InsertarAsientoInput} input - Asiento listo para persistir.
 * @returns {Promise<ResultadoInsertarAsiento>} Id persistido y flag de duplicado.
 */
export async function insertarAsientoConNumeracion(
	tx: PostingTx,
	ctx: ContextoPosting,
	input: InsertarAsientoInput,
	assertAuthority?: () => void,
): Promise<ResultadoInsertarAsiento> {
	return withAccountingTenantLock(
		tx,
		ctx.tenantId,
		async () => {
			// The earlier idempotency check runs before the lock. This catches a
			// concurrent winner under READ COMMITTED. Stricter isolation may retain
			// an older snapshot, so any INSERT conflict must escape to the outer
			// transaction boundary rather than being queried here.
			const existente = await tx.asiento.findUnique({
				where: {
					tenantId_origenTipo_origenId: {
						tenantId: ctx.tenantId,
						origenTipo: input.origenTipo,
						origenId: input.origenId,
					},
				},
			});
			if (existente) return { asientoId: existente.asientoId, duplicado: true };

			const agregado = await tx.asiento.aggregate({
				_max: { numero: true },
				where: { diarioId: input.diarioId, periodoId: input.periodoId },
			});
			const numero = (agregado._max.numero ?? 0) + 1;

			const historial = await tx.asiento.findMany({
				where: { tenantId: ctx.tenantId },
				include: { lineas: { orderBy: { orden: 'asc' } } },
			});
			const validacionCadena = validateHashChain(historial, (row) => {
				const hashInput = {
					tenantId: row.tenantId,
					diarioId: row.diarioId,
					periodoId: row.periodoId,
					numero: row.numero,
					fecha: row.fecha,
					origenTipo: row.origenTipo,
					origenId: row.origenId,
					hashAnterior: row.hashAnterior,
					lineas: row.lineas.map((line) => ({
						orden: line.orden,
						cuentaId: line.cuentaId,
						debe: row.hashVersion === 'legacy-number-v1' ? Number(line.debe) : String(line.debe),
						haber: row.hashVersion === 'legacy-number-v1' ? Number(line.haber) : String(line.haber),
					})),
				};
				return row.hashVersion === 'canonical-v2'
					? construirHashAsientoV2({ ...hashInput, tenantSequence: row.tenantSequence ?? BigInt(0) })
					: construirHashAsiento(hashInput);
			});
			if (!validacionCadena.valid) {
				throw new ActionError('La cadena histórica no es íntegra o está sin clasificar', 'HASH_CHAIN_INVALID');
			}
			const ultimo = validacionCadena.ordered.at(-1);
			const tenantSequence = BigInt(ultimo?.tenantSequence ?? 0) + BigInt(1);
			const hashAnterior = ultimo?.hash ?? null;

			const hash = construirHashAsientoV2({
				tenantId: ctx.tenantId,
				diarioId: input.diarioId,
				periodoId: input.periodoId,
				numero,
				fecha: input.fecha,
				origenTipo: input.origenTipo,
				origenId: input.origenId,
				lineas: input.lineas,
				hashAnterior,
				tenantSequence,
			});

			assertAuthority?.();
			const creado = await tx.asiento.create({
					data: {
						tenantId: ctx.tenantId,
						diarioId: input.diarioId,
						periodoId: input.periodoId,
						numero,
						fecha: input.fecha,
						descripcion: input.descripcion,
						estado: 'CONTABILIZADO',
						origenTipo: input.origenTipo,
						origenId: input.origenId,
						hash,
						hashAnterior,
						hashVersion: 'canonical-v2',
						tenantSequence,
						createdBy: input.createdBy,
						lineas: { create: input.lineas },
					},
			});
			return { asientoId: creado.asientoId, duplicado: false };
		},
	);
}

/**
 * @description Filtra las líneas de plantilla por condición FX y calcula el
 * monto funcional de cada una según su regla.
 */
function resolverMontos(
	lineas: PlantillaFila[],
	evento: EventoContableValorizado,
): Array<{ linea: PlantillaFila; monto: Prisma.Decimal }> {
	const dif = funcional(evento.auxiliares?.diferenciaFx ?? 0);
	const activa = dif.gt(0) ? 'FX_POSITIVA' : dif.lt(0) ? 'FX_NEGATIVA' : 'SIN_DIFERENCIA_FX';
	const total = funcional(evento.montoFuncional);
	const resultado: Array<{ linea: PlantillaFila; monto: Prisma.Decimal }> = [];
	for (const linea of lineas) {
		if (linea.condicion && linea.condicion !== activa) continue;

		let monto: Prisma.Decimal | null = null;
		switch (linea.montoRegla as ReglaMontoClave) {
			case 'TOTAL':
				monto = total;
				break;
			case 'MONTO_PAGADO':
				monto = funcional(evento.auxiliares?.montoPagado ?? total);
				break;
			case 'COSTO_FIFO':
				monto = evento.auxiliares?.costoFifo == null ? null : funcional(evento.auxiliares.costoFifo);
				break;
			case 'INTERESES':
				monto = evento.auxiliares?.intereses == null ? null : funcional(evento.auxiliares.intereses);
				break;
			case 'TOTAL_MENOS_INTERESES':
				monto = total.minus(funcional(evento.auxiliares?.intereses ?? 0));
				break;
			case 'DIFERENCIA_FX':
				monto = dif.abs();
				break;
			case 'TOTAL_MENOS_DIFERENCIA':
				monto = total.minus(dif.abs());
				break;
			case 'TOTAL_MAS_DIFERENCIA':
				monto = total.plus(dif.abs());
				break;
		}
		if (monto == null || !monto.gt(0)) continue;
		resultado.push({ linea, monto: funcional(monto) });
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
	const inicio = performance.now();

	try {
		// La licencia se consulta en servidor dentro del tx; el ctx del caller no decide features.
		const licencia = await tx.tenantLicense.findFirst({
			where: { tenantId: ctx.tenantId, activa: true, expiracion: { gt: new Date() } },
			include: { plan: { select: { features: true } } },
			orderBy: { inicio: 'desc' },
		});
		if (!licencia) return { estado: 'OMITIDO', motivo: 'SIN_LICENCIA' };
		const features = resolveEffectivePlanFeatures({
			planFeatures: comoFeatures(licencia.plan?.features),
			featureOverrides: comoFeatures(licencia.featureOverrides),
			legacyLicenseFeatures: comoFeatures(licencia.features),
		});
		if (features['contabilidad-formal'] !== true) {
			return { estado: 'OMITIDO', motivo: 'FLAG_INACTIVO' };
		}
		validarEventoMonetario(evento);
		await validarMonedaFuncionalTenant(tx, ctx.tenantId, evento);
		const resultado = await postEventoInterno(tx, ctx, evento, modo);
		if (modo === 'shadow') {
			await registrarResultadoShadow(tx, {
				tenantId: ctx.tenantId, tipoEvento: evento.tipo,
				origenTipo: evento.origen.tipo, origenId: evento.origen.id,
				estado: resultado.estado === 'ERROR_SHADOW' ? 'ERROR_SHADOW' : 'SIMULADO',
				causa: resultado.motivo, duracionMs: Math.ceil(performance.now() - inicio),
			});
		}
		return resultado;
	} catch (error) {
		// La evidencia obligatoria del guard no es un fallo contable recuperable.
		if (error instanceof ActionError && error.code === 'AUDITORIA_FALLIDA') throw error;
		if (modo === 'shadow') {
			// Un fallo de telemetría no se puede ocultar: sin evidencia no hay cobertura.
			if (error instanceof Error && error.message.startsWith('OUTBOX_SHADOW_FALLIDA')) throw error;
			const causa = error instanceof Error ? error.message : 'error';
			try {
				await registrarResultadoShadow(tx, {
					tenantId: ctx.tenantId, tipoEvento: evento.tipo,
					origenTipo: evento.origen.tipo, origenId: evento.origen.id,
					estado: 'ERROR_SHADOW', causa,
					duracionMs: Math.ceil(performance.now() - inicio),
				});
			} catch (falloOutbox) {
				console.error('[contabilidad-formal] fallo de outbox shadow', falloOutbox);
				throw new ActionError('No se pudo registrar la evidencia shadow', 'OUTBOX_SHADOW_FALLIDA');
			}
			logShadow('evento no contabilizado', {
				tipo: evento.tipo,
				origen: `${evento.origen.tipo}:${evento.origen.id}`,
				error: error instanceof Error ? error.message : String(error),
			});
			return { estado: 'ERROR_SHADOW', motivo: causa };
		}
		throw error;
	}
}

/** @description Descarta valores JSON que no son mapas de flags booleanos. */
function comoFeatures(valor: unknown): Record<string, boolean> | null {
	if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
	return Object.fromEntries(
		Object.entries(valor).filter((entrada): entrada is [string, boolean] =>
			typeof entrada[1] === 'boolean'),
	);
}

/** Internal options; the bypass additionally requires verified runtime authority. */
interface OpcionesPosteo {
	capability?: unknown;
	/** Solo el backfill: omitir el guard de períodos. */
	omitirGuard?: boolean;
	/** Solo el backfill: período destinatario explícito. */
	periodoIdForzado?: string;
}

/**
 * @description Replay histórico (CTA-4): postea un evento de negocio omitiendo
 * el guard de períodos — los períodos históricos están cerrados por definición.
 * Solo el servicio de backfill autorizado lo invoca con una capability privada; los writers operativos usan
 * `postEvento`. El período destinatario es obligatorio y explícito.
 * @param {PostingTx} tx - Transacción del replay por período.
 * @param {ContextoPosting} ctx - Tenant y actor de la ejecución.
 * @param {EventoContableInput} evento - Evento de negocio reconstruido.
 * @param {string} periodoId - Período contable destinatario (ya validado).
 * @param {unknown} capability - Autoridad runtime privada del replay autorizado.
 * @returns {Promise<PostEventoResult>} Contabilizado o YA_EXISTENTE.
 */
export async function replayEvento(
	tx: PostingTx,
	ctx: ContextoPosting,
	evento: EventoContableInput,
	periodoId: string,
	capability?: unknown,
): Promise<PostEventoResult> {
	validarEventoMonetario(evento);
	assertReplayPostingCapability(capability, tx, ctx, evento, periodoId);
	return postEventoInterno(tx, ctx, evento, 'enforce', {
		omitirGuard: true,
		periodoIdForzado: periodoId,
		capability,
	});
}

async function postEventoInterno(
	tx: PostingTx,
	ctx: ContextoPosting,
	evento: EventoContableValorizado,
	modo: ModoMotorContable,
	opciones?: OpcionesPosteo,
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
		throw new ActionError('El plan contable no está inicializado', 'PLAN_NO_INICIALIZADO');
	}

	// Gobernanza: mismo guard que bloquea la escritura de la base caja. El
	// replay histórico lo omite porque su origen ya es deliberado.
	if (!opciones?.omitirGuard) {
		const validacion = await PeriodoGuard.assertWritable(
			evento.fecha,
			ctx.tenantId,
			'asiento',
			{ actorId: ctx.userId, actorTipo: 'USUARIO', origen: evento.origen },
		);
		if (!validacion.permitido) {
			throw new ActionError(
				validacion.error ??
					'El período contable está cerrado para esa fecha',
				validacion.codigo ?? 'PERIODO_CERRADO',
			);
		}
	}

	const resolucion = opciones?.periodoIdForzado
		? { periodo: { periodoId: opciones.periodoIdForzado } }
		: await PeriodoContableService.resolverPeriodoActivo(
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
			debe: linea.lado === 'DEBE' ? monto : funcional(0),
			haber: linea.lado === 'HABER' ? monto : funcional(0),
			monedaOriginal: esTotal ? evento.moneda : evento.monedaFuncional,
			montoOriginal: esTotal
				? new Prisma.Decimal(serializarDecimalEntrada(
					evento.monto,
					'MONTO_ORIGINAL',
					ASIENTO_LINEA_MONTO_LIMIT,
				))
				: monto,
			tasaCambio: esTotal && evento.tasaCambio != null
				? new Prisma.Decimal(serializarDecimalEntrada(
					evento.tasaCambio,
					'TASA_CAMBIO',
					ASIENTO_LINEA_TASA_LIMIT,
				)) : null,
			fxEvidenceFingerprint: esTotal ? (evento.fxEvidenceFingerprint ?? null) : null,
			referencia: evento.referencia ?? null,
		};
	});

	const totalDebe = lineas.reduce((acc, l) => acc.plus(l.debe), funcional(0));
	const totalHaber = lineas.reduce((acc, l) => acc.plus(l.haber), funcional(0));
	if (!totalDebe.eq(totalHaber)) {
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
	if (modo === 'shadow') {
		const intento = await intentarPosteoShadow(tx, () => insertarAsientoConNumeracion(tx, ctx, {
			diarioId: diario.diarioId, periodoId, fecha: evento.fecha,
			descripcion: evento.descripcion, origenTipo: evento.origen.tipo,
			origenId: evento.origen.id, lineas, createdBy: ctx.userId,
		}));
		return intento.ok ? { estado: 'SIMULADO' } : {
			estado: 'ERROR_SHADOW',
			motivo: intento.error instanceof Error ? intento.error.message : 'error SQL',
		};
	}

	const resultado = await insertarAsientoConNumeracion(tx, ctx, {
		diarioId: diario.diarioId,
		periodoId,
		fecha: evento.fecha,
		descripcion: evento.descripcion,
		origenTipo: evento.origen.tipo,
		origenId: evento.origen.id,
		lineas,
		createdBy: ctx.userId,
	}, opciones?.omitirGuard
		? () => assertReplayPostingCapability(opciones.capability, tx, ctx, evento, periodoId)
		: undefined);

	return resultado.duplicado
		? { estado: 'YA_EXISTENTE', asientoId: resultado.asientoId }
		: { estado: 'CONTABILIZADO', asientoId: resultado.asientoId };
}
