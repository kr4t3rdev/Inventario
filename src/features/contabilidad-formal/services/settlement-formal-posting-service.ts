import {
	postEvento,
	type ContextoPosting,
	type DecimalInput,
	type PostEventoResult,
	type PostingTx,
} from './posting-engine';
import {
	buildCobroCxcEvent,
	buildCobroServicioEvent,
	buildPagoCxpEvent,
	type SettlementEventParams,
} from '../lib/settlement-event-builder';

/**
 * @description Emite el evento formal de liquidación (cobro CxC, cobro servicio, pago CxP)
 * usando el modo global de contabilidad formal.
 *
 * A diferencia del emisor no-Cash, este emisor no depende del gate
 * `CONTABILIDAD_FORMAL_NO_CASH_MODE` y respeta `CONTABILIDAD_FORMAL_MODE`.
 *
 * @param {PostingTx} tx - Transacción Prisma del writer.
 * @param {ContextoPosting} ctx - Tenant y usuario que origina el evento.
 * @param {SettlementEventParams} params - Parámetros de la liquidación.
 * @returns {Promise<PostEventoResult>} Resultado del motor contable formal.
 */
export async function emitirLiquidacionFormal(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: SettlementEventParams & { tipo: 'COBRO_CXC' | 'COBRO_SERVICIO' | 'PAGO_CXP' },
): Promise<PostEventoResult> {
	const montoNum = typeof params.amount === 'number' ? params.amount : Number(params.amount);
	if (!Number.isFinite(montoNum) || montoNum <= 0) {
		return { estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' };
	}
	const evento =
		params.tipo === 'COBRO_CXC'
			? buildCobroCxcEvent(params)
			: params.tipo === 'COBRO_SERVICIO'
				? buildCobroServicioEvent(params)
				: buildPagoCxpEvent(params);

	return postEvento(tx, ctx, evento, {});
}