/**
 * @description Emisor formal de la venta de servicios (S4(e)).
 *
 * Reconoce el ingreso por servicio y la cuenta por cobrar que el cobro
 * posterior liquidará (`COBRO_SERVICIO`). El anticipo aplicado a la venta
 * compensa parte de esa cuenta por cobrar mediante su propio evento
 * (`ANTICIPO_CLIENTE_APLICADO`), de modo que ambos eventos encajan sin
 * duplicar el ingreso.
 *
 * @module src/features/contabilidad-formal/services/service-sale-posting-service
 */
import { resolverValuacionOperativa } from '../lib/functional-valuation-resolver';
import {
	postEvento,
	type ContextoPosting,
	type PostEventoResult,
	type PostingTx,
} from './posting-engine';

/** Origen idempotente del evento: una venta de servicio concreta. */
const VENTA_SERVICIO_ORIGIN_TYPE = 'venta_servicio';

/** Parámetros del reconocimiento formal de una venta de servicios. */
export interface VentaServicioPostingParams {
	/** Identificador de la fila `VentaServicios` que origina el evento. */
	ventaServicioId: string;
	/** Fecha efectiva del asiento (fecha de la venta). */
	fecha: Date;
	/** Total de la venta en la moneda de la operación. */
	monto: number;
	/** Moneda de la operación (moneda del catálogo del servicio). */
	moneda: string;
}

/**
 * @description Reconoce formalmente la venta de servicios: debita la cuenta por
 * cobrar y acredita el ingreso por servicios. El cobro posterior (o el anticipo
 * aplicado) liquida esa cuenta por cobrar con su propio evento.
 * @param {PostingTx} tx - Transacción Prisma de la venta de servicios.
 * @param {ContextoPosting} ctx - Tenant y usuario que registran la venta.
 * @param {VentaServicioPostingParams} params - Venta persistida y su valoración.
 * @returns {Promise<PostEventoResult>} Resultado de la emisión formal.
 */
export async function emitirVentaServicio(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: VentaServicioPostingParams,
): Promise<PostEventoResult> {
	const monto = Math.abs(params.monto);
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
		source: 'service-sale-posting-service',
	});

	return postEvento(tx, ctx, {
		tipo: 'VENTA_SERVICIO_CREDITO',
		fecha: params.fecha,
		descripcion: `Venta de servicio ${params.ventaServicioId}`,
		origen: { tipo: VENTA_SERVICIO_ORIGIN_TYPE, id: params.ventaServicioId },
		monto,
		moneda,
		montoFuncional: valoracion.montoFuncional,
		monedaFuncional: valoracion.monedaFuncional,
		tasaCambio: valoracion.tasaCambio,
		fxEvidenceFingerprint: valoracion.fxEvidenceFingerprint,
	});
}
