import {
	postEvento,
	type ContextoPosting,
	type PostEventoResult,
	type PostingTx,
} from './posting-engine';
import { resolveModoEmisorNoCash } from './non-cash-emitter-gate';
import { buildAnticipoEvent, type AnticipoEventParams } from '../lib/advance-event-builder';

/**
 * @description Emite el asiento de un movimiento de anticipo dentro de la
 * transacción operativa y con el gate de rollout no Cash.
 * @param {PostingTx} tx - Transacción Prisma activa.
 * @param {ContextoPosting} ctx - Tenant y actor autenticados.
 * @param {AnticipoEventParams} params - Movimiento y valoración persistidos.
 * @returns {Promise<PostEventoResult>} Resultado del motor formal.
 */
export async function emitirEventoAnticipo(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: AnticipoEventParams,
): Promise<PostEventoResult> {
	const modo = resolveModoEmisorNoCash();
	if (modo === 'off') {
		return { estado: 'OMITIDO', motivo: 'EMISOR_NO_CASH_DESACTIVADO' };
	}

	return postEvento(tx, ctx, buildAnticipoEvent(params), { modo });
}
