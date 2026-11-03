import {
	postEvento,
	type ContextoPosting,
	type PostEventoResult,
	type PostingTx,
} from './posting-engine';
import { buildAnticipoEvent } from '../lib/advance-event-builder';

const ANTICIPO_APLICACION_ORIGIN_TYPE = 'anticipo_movimiento';

/**
 * @description Emite el reconocimiento formal de una aplicación de anticipo.
 * Se usa cuando el workflow persiste la valoración y se llama desde
 * `applyAdvanceWorkflow` dentro de la transacción operativa.
 * @param {PostingTx} tx - Transacción Prisma del workflow.
 * @param {ContextoPosting} ctx - Tenant y usuario que originan el evento.
 * @param {string} anticipoMovimientoId - Id del movimiento de anticipo aplicado.
 * @param {number} monto - Importe aplicado en la moneda de la operación.
 * @param {string} moneda - Moneda de la operación (normalizada en mayúsculas).
 * @param {number} montoFuncional - Importe convertido a la moneda funcional del tenant.
 * @param {string} monedaFuncional - Moneda funcional del tenant.
 * @param {number | null} tasaCambio - Tasa publicada utilizada para la conversión.
 * @param {string | null} fxEvidenceFingerprint - Huella de la evidencia FX.
 * @param {string} tipoEvento - Tipo de evento a emitir (APLICADO, DEVUELTO, REINTEGADO).
 * @param {string | null} diferenciaFx - Diferencia FX residual (solo aplicaciones).
 * @returns {Promise<PostEventoResult>} Resultado del motor contable formal.
 */
export async function emitirAplicacionAnticipo(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: {
		anticipoMovimientoId: string;
		fecha: Date;
		monto: number;
		moneda: string;
		montoFuncional: number | null;
		monedaFuncional: string | null;
		tasaCambio: number | null;
		fxEvidenceFingerprint: string | null;
		tipoEvento: 'ANTICIPO_CLIENTE_APLICADO' | 'ANTICIPO_PROVEEDOR_APLICADO';
		diferenciaFx?: number | null;
	},
): Promise<PostEventoResult> {
	if (!Number.isFinite(params.monto) || params.monto <= 0) {
		return { estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' };
	}
	return postEvento(tx, ctx, buildAnticipoEvent({
		anticipoMovimientoId: params.anticipoMovimientoId,
		tipo: params.tipoEvento,
		fecha: params.fecha,
		monto: params.monto,
		moneda: params.moneda,
		montoFuncional: params.montoFuncional,
		monedaFuncional: params.monedaFuncional,
		tasaCambio: params.tasaCambio,
		fxEvidenceFingerprint: params.fxEvidenceFingerprint,
		diferenciaFx: params.diferenciaFx,
	}));
}

/**
 * @description Emite el reverso de una aplicación de anticipo cuando se anula o corrige.
 * El origen del reverso es `anticipo_movimiento_reversado:<movimientoId>`.
 * @param {PostingTx} tx - Transacción Prisma del workflow.
 * @param {ContextoPosting} ctx - Tenant y usuario que originan el evento.
 * @param {string} anticipoMovimientoId - Id del movimiento de anticipo original.
 * @param {number} monto - Importe a revertir (positivo).
 * @param {Date} fecha - Fecha del asiento.
 * @param {number | null} montoFuncional - Importe en moneda funcional.
 * @param {string | null} monedaFuncional - Moneda funcional.
 * @param {number | null} tasaCambio - Tasa usada en el reverso.
 * @param {string | null} fxEvidenceFingerprint - Huella FX del reverso.
 * @param {string} tipoReverso - Tipo de reverso (CLIENTE_APLICACION_REVERSADA o PROVEEDOR_APLICACION_REVERSADA).
 * @returns {Promise<PostEventoResult>} Resultado del motor contable formal.
 */
export async function emitirReversionAplicacionAnticipo(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: {
		anticipoMovimientoId: string;
		fecha: Date;
		monto: number;
		montoFuncional: number | null;
		monedaFuncional: string | null;
		tasaCambio: number | null;
		fxEvidenceFingerprint: string | null;
		tipoReverso: 'ANTICIPO_CLIENTE_APLICACION_REVERSADA' | 'ANTICIPO_PROVEEDOR_APLICACION_REVERSADA';
	},
): Promise<PostEventoResult> {
	if (!Number.isFinite(params.monto) || params.monto <= 0) {
		return { estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' };
	}
	return postEvento(tx, ctx, buildAnticipoEvent({
		anticipoMovimientoId: params.anticipoMovimientoId,
		tipo: params.tipoReverso,
		fecha: params.fecha,
		monto: params.monto,
		moneda: 'CUP',
		montoFuncional: params.montoFuncional,
		monedaFuncional: params.monedaFuncional,
		tasaCambio: params.tasaCambio,
		fxEvidenceFingerprint: params.fxEvidenceFingerprint,
	}));
}

/**
 * @description Emite el evento de devolución/reintegro de fondos de anticipo.
 * @param {PostingTx} tx - Transacción Prisma del workflow.
 * @param {ContextoPosting} ctx - Tenant y usuario que originan el evento.
 * @param {string} anticipoMovimientoId - Id del movimiento de devolución.
 * @param {number} monto - Importe devuelto.
 * @param {string} moneda - Moneda de la operación.
 * @param {number | null} montoFuncional - Importe en moneda funcional.
 * @param {string | null} monedaFuncional - Moneda funcional del tenant.
 * @param {number | null} tasaCambio - Tasa de conversión.
 * @param {string | null} fxEvidenceFingerprint - Huella FX.
 * @param {string} tipoEvento - Tipo de evento (DEVUELTO o REINTEGADO).
 * @param {string} treasuryAccountType - Tipo de cuenta tesorería (EFECTIVO/BANCOS).
 * @returns {Promise<PostEventoResult>} Resultado del motor contable formal.
 */
export async function emitirDevolucionAnticipo(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: {
		anticipoMovimientoId: string;
		fecha: Date;
		monto: number;
		moneda: string;
		montoFuncional: number | null;
		monedaFuncional: string | null;
		tasaCambio: number | null;
		fxEvidenceFingerprint: string | null;
		tipoEvento: 'ANTICIPO_CLIENTE_DEVUELTO' | 'ANTICIPO_PROVEEDOR_REINTEGRADO';
		treasuryAccountType: string | null;
	},
): Promise<PostEventoResult> {
	if (!Number.isFinite(params.monto) || params.monto <= 0) {
		return { estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' };
	}
	return postEvento(tx, ctx, buildAnticipoEvent({
		anticipoMovimientoId: params.anticipoMovimientoId,
		tipo: params.tipoEvento,
		fecha: params.fecha,
		monto: params.monto,
		moneda: params.moneda,
		montoFuncional: params.montoFuncional,
		monedaFuncional: params.monedaFuncional,
		tasaCambio: params.tasaCambio,
		fxEvidenceFingerprint: params.fxEvidenceFingerprint,
		treasuryAccountType: params.treasuryAccountType,
	}));
}