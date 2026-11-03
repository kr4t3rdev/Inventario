import {
	postEvento,
	type ContextoPosting,
	type PostEventoResult,
	type PostingTx,
} from './posting-engine';
import { buildAnticipoEvent, type AnticipoEventParams } from '../lib/advance-event-builder';

/** Eventos de anticipo soportados */
type AnticipoEventType =
	| 'ANTICIPO_CLIENTE_RECIBIDO'
	| 'ANTICIPO_PROVEEDOR_ENTREGADO'
	| 'ANTICIPO_CLIENTE_DEVUELTO'
	| 'ANTICIPO_PROVEEDOR_REINTEGRADO'
	| 'ANTICIPO_CLIENTE_APLICADO'
	| 'ANTICIPO_PROVEEDOR_APLICADO'
	| 'ANTICIPO_CLIENTE_APLICACION_REVERSADA'
	| 'ANTICIPO_PROVEEDOR_APLICACION_REVERSADA';

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
 * @param {number | null} tasaCambio - Tasa publicada utilizada para la conversión (puede ser null si misma moneda).
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
		montoFuncional: number;
		monedaFuncional: string;
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
		tasaCambio: params.tasaCambio ?? undefined,
		fxEvidenceFingerprint: params.fxEvidenceFingerprint ?? undefined,
		diferenciaFx: params.diferenciaFx ?? undefined,
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
 * @param {number} montoFuncional - Importe en moneda funcional (no null).
 * @param {string} monedaFuncional - Moneda funcional (no null).
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
		montoFuncional: number;
		monedaFuncional: string;
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
		tasaCambio: params.tasaCambio ?? undefined,
		fxEvidenceFingerprint: params.fxEvidenceFingerprint ?? undefined,
	}));
}

/**
 * @description Emite el evento de devolución/reintegro de fondos de anticipo.
 * @param {PostingTx} tx - Transacción Prisma del workflow.
 * @param {ContextoPosting} ctx - Tenant y usuario que originan el evento.
 * @param {string} anticipoMovimientoId - Id del movimiento de devolución.
 * @param {number} monto - Importe devuelto.
 * @param {string} moneda - Moneda de la operación.
 * @param {number} montoFuncional - Importe en moneda funcional.
 * @param {string} monedaFuncional - Moneda funcional del tenant.
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
		montoFuncional: number;
		monedaFuncional: string;
		tasaCambio: number | null;
		fxEvidenceFingerprint: string | null;
		tipoEvento: 'ANTICIPO_CLIENTE_DEVUELTO' | 'ANTICIPO_PROVEEDOR_REINTEGRADO';
		treasuryAccountType: string;
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
		tasaCambio: params.tasaCambio ?? undefined,
		fxEvidenceFingerprint: params.fxEvidenceFingerprint ?? undefined,
		treasuryAccountType: params.treasuryAccountType,
	}));
}

/**
 * @description Emite cualquier evento formal de anticipo, manejando recibido/entregado/devuelto/reintegrado.
 * Función genérica usada por el workflow existente.
 * @param {PostingTx} tx - Transacción Prisma del workflow.
 * @param {ContextoPosting} ctx - Tenant y usuario que originan el evento.
 * @param {AnticipoEventParams} params - Parámetros del evento (adaptados al formato buildAnticipoEvent).
 * @returns {Promise<PostEventoResult>} Resultado del motor contable formal.
 */
export async function emitirEventoAnticipo(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: AnticipoEventParams & { tipoEvento?: AnticipoEventType },
): Promise<PostEventoResult> {
	const tipo = params.tipoEvento ?? params.tipo;
	const montoNum = typeof params.monto === 'number' ? params.monto : Number(params.monto);
	if (!Number.isFinite(montoNum) || montoNum <= 0) {
		return { estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' };
	}
	return postEvento(tx, ctx, buildAnticipoEvent({
		...params,
		tipo,
		monedaFuncional: params.monedaFuncional ?? 'CUP',
		montoFuncional: typeof params.montoFuncional === 'number'
			? params.montoFuncional
			: Number(params.montoFuncional ?? 0),
	}), {});
}

/**
 * @description Alias para compatibilidad con el workflow existente.
 * Emite el reverso de una aplicación de anticipo.
 */
export const emitirReversoAnticipo = emitirReversionAplicacionAnticipo;