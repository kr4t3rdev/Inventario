/**
 * @description Emisor formal de liquidaciones (cobro CxC, cobro de servicio y
 * pago CxP) gobernado por el modo global de la capa formal.
 *
 * A diferencia del emisor no-Cash (`settlement-posting-service.ts`), este
 * emisor no depende del gate `CONTABILIDAD_FORMAL_NO_CASH_MODE`: respeta el
 * modo global `CONTABILIDAD_FORMAL_MODE`, igual que los emisores de compras,
 * mermas, produccion y anticipos.
 *
 * Comparte con el emisor no-Cash la resolucion de la valoracion funcional
 * (`construirEventoLiquidacion`), de modo que cambiar de emisor no altera el
 * asiento: solo cambia el gate que gobierna el rollout.
 *
 * @module src/features/contabilidad-formal/services/settlement-formal-posting-service
 */
import {
	postEvento,
	type ContextoPosting,
	type PostEventoResult,
	type PostingTx,
} from './posting-engine';
import {
	construirEventoLiquidacion,
	type SettlementPostingParams,
} from './settlement-posting-service';

/**
 * @description Emite el evento formal de liquidacion usando el modo global.
 * @param {PostingTx} tx - Transaccion Prisma del writer (misma atomicidad).
 * @param {ContextoPosting} ctx - Tenant y actor de la operacion.
 * @param {SettlementPostingParams} params - Conciliacion y datos de emision.
 * @returns {Promise<PostEventoResult>} Estado del posteo formal.
 */
export async function emitirLiquidacionFormal(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: SettlementPostingParams,
): Promise<PostEventoResult> {
	const monto = Number(params.reconciliacion.monto);
	if (!Number.isFinite(monto) || monto <= 0) {
		return { estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' };
	}

	const evento = await construirEventoLiquidacion(tx, ctx, params);
	return postEvento(tx, ctx, evento);
}
