/**
 * @description Emisor formal del ingreso por venta de productos (S4(a)).
 *
 * El reconocimiento depende de como se cobre la factura:
 *
 * - `VENTA_CONTADO`: la factura se cobra al momento de emitirse. El asiento
 *   debita la tesoreria (caja o bancos) y acredita el ingreso por ventas; no
 *   existe cuenta por cobrar que liquidar, porque la venta nunca fue a plazo.
 * - `VENTA_CREDITO`: la factura queda a plazo. El asiento debita la cuenta por
 *   cobrar y acredita el ingreso; el cobro posterior (`COBRO_CXC`) liquida esa
 *   misma cuenta por cobrar.
 *
 * El emisor al contado consume la valoracion ya persistida en la
 * conciliacion de caja (no recalcula moneda ni tipo de cambio). El emisor a
 * credito valora el importe de la factura con la tasa publicada vigente en la
 * fecha de la operacion, porque la factura todavia no tiene conciliacion.
 *
 * @module src/features/contabilidad-formal/services/sale-posting-service
 */
import { resolverValuacionOperativa } from '../lib/functional-valuation-resolver';
import { derivarMedioCobro } from '../lib/settlement-event-builder';
import {
	postEvento,
	type ContextoPosting,
	type DecimalInput,
	type PostEventoResult,
	type PostingTx,
} from './posting-engine';

/** Origen idempotente del reconocimiento de venta a credito: la factura. */
const VENTA_CREDITO_ORIGIN_TYPE = 'factura';

/** Origen idempotente del reconocimiento de venta al contado: la conciliacion. */
const VENTA_CONTADO_ORIGIN_TYPE = 'reconciliacion_venta';

/** Origen idempotente del devengo del costo de venta: la venta. */
const COSTO_VENTA_ORIGIN_TYPE = 'venta_costo';

/** Parametros del reconocimiento formal de una venta a credito. */
export interface VentaCreditoPostingParams {
	/** Identificador de la factura que origina el evento. */
	facturaId: string;
	/** Fecha efectiva del asiento (fecha de la operacion). */
	fecha: Date;
	/** Total de la factura en la moneda de la operacion. */
	monto: DecimalInput;
	/** Moneda de la operacion; por defecto la moneda operativa (CUP). */
	moneda?: string;
	/** Descripcion legible del asiento. */
	descripcion?: string;
}

/** Parametros del reconocimiento formal de una venta al contado. */
export interface VentaContadoPostingParams {
	/** Identificador de la conciliacion de caja que origina el evento. */
	reconciliacionId: string;
	/** Fecha efectiva del asiento (fecha de la conciliacion). */
	fecha: Date;
	/** Importe cobrado en la moneda de la cuenta bancaria. */
	monto: DecimalInput;
	/** Moneda de la cuenta bancaria que recibe el cobro. */
	moneda: string;
	/** Importe ya convertido a moneda funcional (null si no se persistio). */
	montoFuncional?: DecimalInput | null;
	/** Moneda funcional del tenant. */
	monedaFuncional?: string | null;
	/** Tasa aplicada en la conciliacion. */
	tasaCambio?: DecimalInput | null;
	/** Huella de la evidencia FX persistida. */
	fxEvidenceFingerprint?: string | null;
	/** Tipo de la cuenta bancaria (EFECTIVO = CAJA, resto = BANCOS). */
	treasuryAccountType?: string | null;
	/** Referencia externa de la operacion. */
	referencia?: string;
	/** Descripcion legible del asiento. */
	descripcion?: string;
}

/**
 * @description Reconoce formalmente una venta a credito: debita la cuenta por
 * cobrar y acredita el ingreso por ventas. El cobro posterior liquida esa
 * cuenta por cobrar con su propio evento.
 * @param {PostingTx} tx - Transaccion Prisma del writer de facturacion.
 * @param {ContextoPosting} ctx - Tenant y usuario que registraron la venta.
 * @param {VentaCreditoPostingParams} params - Factura, importe y fecha.
 * @returns {Promise<PostEventoResult>} Resultado de la emision formal.
 */
export async function emitirVentaCredito(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: VentaCreditoPostingParams,
): Promise<PostEventoResult> {
	const monto = Math.abs(Number(params.monto));
	if (!Number.isFinite(monto) || monto <= 0) {
		return { estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' };
	}
	const moneda = params.moneda?.trim().toUpperCase() || 'CUP';
	const valoracion = await resolverValuacionOperativa({
		tx,
		tenantId: ctx.tenantId,
		monto,
		moneda,
		fechaOperacion: params.fecha,
		source: 'sale-posting-service',
	});

	return postEvento(tx, ctx, {
		tipo: 'VENTA_CREDITO',
		fecha: params.fecha,
		descripcion: params.descripcion ?? `Venta a credito ${params.facturaId}`,
		origen: { tipo: VENTA_CREDITO_ORIGIN_TYPE, id: params.facturaId },
		monto,
		moneda,
		montoFuncional: valoracion.montoFuncional,
		monedaFuncional: valoracion.monedaFuncional,
		tasaCambio: valoracion.tasaCambio,
		fxEvidenceFingerprint: valoracion.fxEvidenceFingerprint,
	});
}

/**
 * @description Reconoce formalmente una venta cobrada al contado: debita la
 * tesoreria y acredita el ingreso por ventas. No hay cuenta por cobrar que
 * liquidar, porque el cobro ocurre en el mismo instante de la venta.
 * @param {PostingTx} tx - Transaccion Prisma del writer de facturacion.
 * @param {ContextoPosting} ctx - Tenant y usuario que cobraron la venta.
 * @param {VentaContadoPostingParams} params - Conciliacion y valoracion persistida.
 * @returns {Promise<PostEventoResult>} Resultado de la emision formal.
 */
export async function emitirVentaContado(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: VentaContadoPostingParams,
): Promise<PostEventoResult> {
	const monto = Math.abs(Number(params.monto));
	if (!Number.isFinite(monto) || monto <= 0) {
		return { estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' };
	}

	return postEvento(tx, ctx, {
		tipo: 'VENTA_CONTADO',
		fecha: params.fecha,
		descripcion: params.descripcion ?? 'Venta al contado',
		origen: { tipo: VENTA_CONTADO_ORIGIN_TYPE, id: params.reconciliacionId },
		monto,
		moneda: params.moneda,
		montoFuncional: params.montoFuncional ?? null,
		monedaFuncional: params.monedaFuncional ?? null,
		tasaCambio: params.tasaCambio ?? null,
		fxEvidenceFingerprint: params.fxEvidenceFingerprint ?? null,
		medioCobro: derivarMedioCobro(params.treasuryAccountType),
		...(params.referencia == null ? {} : { referencia: params.referencia }),
	});
}

/** Parametros del devengo formal del costo de venta. */
export interface CostoVentaPostingParams {
	/** Identificador de la venta que origina el devengo. */
	ventaId: string;
	/** Fecha efectiva del asiento (fecha de la entrega de la mercaderia). */
	fecha: Date;
	/** Costo FIFO en moneda funcional; null si no se pudo valorar. */
	costoFifo: number | null;
	/** Moneda funcional del tenant; null si el tenant no tiene politica. */
	monedaFuncional: string | null;
	/** Descripcion legible del asiento. */
	descripcion?: string;
}

/**
 * @description Devenga formalmente el costo de la mercaderia vendida: debita el
 * costo de ventas y acredita el inventario por el costo FIFO real de los lotes
 * consumidos.
 *
 * El costo ya llega valorado en la moneda funcional (cada porcion del FIFO con
 * la tasa vigente de su fuente), de modo que el asiento no recalcula moneda ni
 * tipo de cambio: las dos lineas se mueven por el mismo importe funcional.
 *
 * Si el costo no pudo valorarse (falta la tasa publicada de una fuente), el
 * evento se emite sin valoracion funcional para que el motor falle cerrado en
 * modo `enforce` y registre la causa en modo `shadow`.
 *
 * @param {PostingTx} tx - Transaccion Prisma del writer de ventas.
 * @param {ContextoPosting} ctx - Tenant y usuario que registraron la entrega.
 * @param {CostoVentaPostingParams} params - Venta, costo FIFO y fecha.
 * @returns {Promise<PostEventoResult>} Resultado de la emision formal.
 */
export async function emitirCostoVenta(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: CostoVentaPostingParams,
): Promise<PostEventoResult> {
	const costo = params.costoFifo == null ? null : Math.abs(Number(params.costoFifo));
	const monedaFuncional = params.monedaFuncional?.trim().toUpperCase() || null;

	return postEvento(tx, ctx, {
		tipo: 'COSTO_VENTA_DEVENGADO',
		fecha: params.fecha,
		descripcion: params.descripcion ?? `Costo de venta devengado ${params.ventaId}`,
		origen: { tipo: COSTO_VENTA_ORIGIN_TYPE, id: params.ventaId },
		monto: costo ?? 0,
		moneda: monedaFuncional,
		montoFuncional: costo,
		monedaFuncional,
		tasaCambio: null,
		fxEvidenceFingerprint: null,
		...(costo == null ? {} : { auxiliares: { costoFifo: costo } }),
	});
}
