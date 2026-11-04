/**
 * @description Emisor formal de los ajustes bancarios y las inyecciones de
 * capital (S8).
 *
 * Estas operaciones mueven la tesoreria sin contraparte operativa: no liquidan
 * una cuenta por cobrar ni pagan una cuenta por pagar. Su formalizacion usa
 * las plantillas del plan:
 *
 *  - `AJUSTE_BANCARIO_ABONO`: DEBE bancos / HABER otros ingresos.
 *  - `AJUSTE_BANCARIO_CARGO`: DEBE gastos financieros / HABER bancos.
 *  - `INYECCION_CAPITAL`: DEBE caja (o bancos) / HABER capital social.
 *  - `DEUDA_RECIBIDA`: DEBE caja (o bancos) / HABER deudas recibidas.
 *
 * El emisor no recalcula la valoracion desde la nada: consume el importe y la
 * tasa que el writer operativo ya decidio (y que su documento registra), y
 * deriva de ellos la evidencia funcional. Si la moneda operativa no tiene conversion posible, el importe
 * funcional queda nulo y el motor falla cerrado en vez de inventar una
 * equivalencia.
 *
 * @module src/features/contabilidad-formal/services/capital-adjustment-posting-service
 */
import { buildFunctionalValuation } from '../lib/functional-valuation';
import {
	postEvento,
	type ContextoPosting,
	type DecimalInput,
	type PostEventoResult,
	type PostingTx,
} from './posting-engine';

/** Origen idempotente del ajuste bancario. */
const AJUSTE_BANCARIO_ORIGIN_TYPE = 'ajuste_bancario';

/** Origen idempotente de la inyeccion de capital. */
const INYECCION_CAPITAL_ORIGIN_TYPE = 'inyeccion_capital';

/** Sentido operativo del ajuste bancario. */
export type TipoAjusteBancario = 'ingreso' | 'egreso';

/** Tipo operativo de la inyeccion de capital. */
export type TipoInyeccionCapital = 'CAPITAL_SOCIAL' | 'DEUDA_EXTERNA';

/** Datos del ajuste bancario ya persistidos. */
export interface AjusteBancarioPostingParams {
	/** Identificador del ajuste (`AjusteBancario.ajusteId`). */
	ajusteId: string;
	/** Fecha de operacion del ajuste. */
	fecha: Date;
	/** Importe del ajuste en su moneda original. */
	monto: DecimalInput;
	/** Moneda del ajuste. */
	moneda: string;
	/** Tasa aplicada por el writer operativo, si la moneda no es funcional. */
	tasaCambio?: DecimalInput | null;
	/** Descripcion persistida del ajuste. */
	descripcion: string;
	/** Referencia operativa (clave de idempotencia) del ajuste. */
	referencia?: string | null;
	/** Sentido del ajuste: ingreso suma saldo, egreso lo resta. */
	tipo: TipoAjusteBancario;
}

/** Datos de la inyeccion de capital ya persistidos. */
export interface InyeccionCapitalPostingParams {
	/** Identificador de la inyeccion (`InyeccionCapital.id`). */
	inyeccionId: string;
	/** Fecha de registro de la inyeccion. */
	fecha: Date;
	/** Importe recibido en su moneda original. */
	monto: DecimalInput;
	/** Moneda de la inyeccion. */
	moneda: string;
	/** Tasa aplicada por el writer operativo, si la moneda no es funcional. */
	tasaCambio?: DecimalInput | null;
	/** Descripcion persistida de la inyeccion. */
	descripcion?: string | null;
	/** Referencia operativa (clave de idempotencia) de la inyeccion. */
	referencia?: string | null;
	/** Naturaleza de la inyeccion: capital propio o deuda externa. */
	tipo: TipoInyeccionCapital;
}

/**
 * @description Emite el asiento formal de un ajuste bancario.
 *
 * El ingreso al banco se acredita como otros ingresos y el egreso se debita
 * como gasto financiero, segun las plantillas del plan. El asiento consume la
 * valoracion persistida por el writer operativo.
 *
 * @param {PostingTx} tx - Transaccion Prisma del ajuste.
 * @param {ContextoPosting} ctx - Tenant y usuario que registran el ajuste.
 * @param {AjusteBancarioPostingParams} params - Ajuste persistido y su valoracion.
 * @returns {Promise<PostEventoResult>} Resultado del motor contable formal.
 */
export async function emitirAjusteBancario(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: AjusteBancarioPostingParams,
): Promise<PostEventoResult> {
	const policy = await tx.tenantAccountingPolicy.findUnique({
		where: { tenantId: ctx.tenantId },
		select: { functionalCurrencyCode: true },
	});
	const functionalCurrency = policy?.functionalCurrencyCode?.trim().toUpperCase() || null;
	const moneda = params.moneda.trim().toUpperCase();
	const valoracion = buildFunctionalValuation({
		monto: Number(params.monto),
		moneda,
		functionalCurrency,
		tasaCambio:
			params.tasaCambio === null || params.tasaCambio === undefined
				? undefined
				: Number(params.tasaCambio),
		fechaOperacion: params.fecha,
		source: 'capital-adjustment-posting-service',
	});

	return postEvento(tx, ctx, {
		tipo: params.tipo === 'ingreso' ? 'AJUSTE_BANCARIO_ABONO' : 'AJUSTE_BANCARIO_CARGO',
		fecha: params.fecha,
		descripcion: params.descripcion,
		origen: { tipo: AJUSTE_BANCARIO_ORIGIN_TYPE, id: params.ajusteId },
		monto: params.monto,
		moneda,
		montoFuncional: valoracion.sameCurrency ? params.monto : valoracion.montoConvertido,
		monedaFuncional: functionalCurrency,
		tasaCambio: valoracion.tasaCambio,
		fxEvidenceFingerprint: valoracion.fxEvidenceFingerprint,
		medioCobro: 'BANCOS',
		...(params.referencia ? { referencia: params.referencia } : {}),
	});
}

/**
 * @description Emite el asiento formal de una inyeccion de capital.
 *
 * El capital propio acredita el capital social y la deuda externa acredita las
 * deudas recibidas; en ambos casos el efectivo debita la tesoreria.
 *
 * @param {PostingTx} tx - Transaccion Prisma de la inyeccion.
 * @param {ContextoPosting} ctx - Tenant y usuario que registran la inyeccion.
 * @param {InyeccionCapitalPostingParams} params - Inyeccion persistida y su valoracion.
 * @returns {Promise<PostEventoResult>} Resultado del motor contable formal.
 */
export async function emitirInyeccionCapital(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: InyeccionCapitalPostingParams,
): Promise<PostEventoResult> {
	const policy = await tx.tenantAccountingPolicy.findUnique({
		where: { tenantId: ctx.tenantId },
		select: { functionalCurrencyCode: true },
	});
	const functionalCurrency = policy?.functionalCurrencyCode?.trim().toUpperCase() || null;
	const moneda = params.moneda.trim().toUpperCase();
	const valoracion = buildFunctionalValuation({
		monto: Number(params.monto),
		moneda,
		functionalCurrency,
		tasaCambio:
			params.tasaCambio === null || params.tasaCambio === undefined
				? undefined
				: Number(params.tasaCambio),
		fechaOperacion: params.fecha,
		source: 'capital-adjustment-posting-service',
	});

	return postEvento(tx, ctx, {
		tipo: params.tipo === 'DEUDA_EXTERNA' ? 'DEUDA_RECIBIDA' : 'INYECCION_CAPITAL',
		fecha: params.fecha,
		descripcion:
			params.descripcion ??
			(params.tipo === 'DEUDA_EXTERNA'
				? 'Recepcion de deuda externa'
				: 'Inyeccion de capital social'),
		origen: { tipo: INYECCION_CAPITAL_ORIGIN_TYPE, id: params.inyeccionId },
		monto: params.monto,
		moneda,
		montoFuncional: valoracion.sameCurrency ? params.monto : valoracion.montoConvertido,
		monedaFuncional: functionalCurrency,
		tasaCambio: valoracion.tasaCambio,
		fxEvidenceFingerprint: valoracion.fxEvidenceFingerprint,
		medioCobro: 'BANCOS',
		...(params.referencia ? { referencia: params.referencia } : {}),
	});
}
