/**
 * @description Servicio de emision de los eventos formales de liquidacion de
 * cuentas por cobrar y por pagar (COBRO_CXC / PAGO_CXP).
 *
 * El servicio es el unico punto de entrada para los writers no Cash: decide
 * el modo de rollout, resuelve la moneda funcional del tenant y delega el
 * posteo en el motor formal. No recalcula la valoracion: consume la que la
 * conciliacion dejo persistida.
 *
 * Modos (`CONTABILIDAD_FORMAL_NO_CASH_MODE`):
 *   - `off`     : no se emite nada (inerte, por defecto).
 *   - `shadow`  : se registra evidencia simulada en la outbox, sin asientos.
 *   - `enforce` : se exige el asiento formal; ante anomalias la escritura
 *                 operativa falla cerrado (el motor valida periodo, plantilla,
 *                 mapeo de cuentas y evidencia FX).
 */

import {
	postEvento,
	type ContextoPosting,
	type DecimalInput,
	type PostEventoResult,
	type PostingTx,
} from './posting-engine';
import { resolveModoEmisorNoCash } from './non-cash-emitter-gate';
import {
	buildCobroCxcEvent,
	buildPagoCxpEvent,
	type SettlementEventParams,
} from '../lib/settlement-event-builder';

/** Datos minimos de la conciliacion que justifican el evento formal. */
export interface SettlementReconciliation {
	reconciliacionId: string;
	monto: DecimalInput;
	moneda: string;
	montoConvertido?: DecimalInput | null;
	functionalCurrency?: string | null;
	tasaCambio?: DecimalInput | null;
	fxEvidenceFingerprint?: string | null;
	fechaReconciliacion: Date;
}

export interface SettlementPostingParams {
	/** Plantilla formal a emitir. */
	tipo: 'COBRO_CXC' | 'PAGO_CXP';
	/** Conciliacion operativa que origina el evento (ya persistida). */
	reconciliacion: SettlementReconciliation;
	/**
	 * Valoracion funcional explicita del writer. Cuando se informa, precede a la
	 * de la conciliacion: hay writers legacy cuyo `montoConvertido` guarda el
	 * importe en la moneda de la cuenta bancaria y no en la moneda funcional.
	 * `null` explicito significa "sin valoracion funcional" (falla cerrada).
	 */
	functionalAmount?: DecimalInput | null;
	/** Moneda funcional explicita del writer. */
	functionalCurrency?: string | null;
	/** Tasa de cambio explicita del writer. */
	exchangeRate?: DecimalInput | null;
	/** Huella de la evidencia FX explicita del writer. */
	fxEvidenceFingerprint?: string | null;
	/** Tipo de la cuenta bancaria emisora (EFECTIVO = CAJA, resto = BANCOS). */
	treasuryAccountType?: string | null;
	/** Referencia externa del evento. */
	referencia?: string;
	/** Descripcion legible del evento. */
	descripcion?: string;
}

/**
 * @description Resuelve la moneda funcional declarada por la politica contable
 * del tenant.
 * @param {PostingTx} tx - Transaccion Prisma activa.
 * @param {string} tenantId - Tenant consulto.
 * @returns {Promise<string | null>} Codigo de moneda funcional o null si no hay politica.
 */
async function resolverMonedaFuncional(
	tx: PostingTx,
	tenantId: string,
): Promise<string | null> {
	const politica = await tx.tenantAccountingPolicy.findUnique({
		where: { tenantId },
		select: { functionalCurrencyCode: true },
	});
	return politica?.functionalCurrencyCode ?? null;
}

/**
 * @description Emite el evento formal de liquidacion desde el writer operativo.
 * @param {PostingTx} tx - Transaccion Prisma del writer (misma atomicidad).
 * @param {ContextoPosting} ctx - Tenant y actor de la operacion.
 * @param {SettlementPostingParams} params - Conciliacion y datos de emision.
 * @returns {Promise<PostEventoResult>} Estado del posteo formal.
 */
export async function emitirEventoLiquidacion(
	tx: PostingTx,
	ctx: ContextoPosting,
	params: SettlementPostingParams,
): Promise<PostEventoResult> {
	const modo = resolveModoEmisorNoCash();
	if (modo === 'off') {
		return { estado: 'OMITIDO', motivo: 'EMISOR_NO_CASH_DESACTIVADO' };
	}

	const conciliacion = params.reconciliacion;
	const monedaFuncional = (
		params.functionalCurrency ??
		conciliacion.functionalCurrency ??
		(await resolverMonedaFuncional(tx, ctx.tenantId))
	)?.trim().toUpperCase() ?? null;
	const mismaMoneda =
		monedaFuncional != null &&
		conciliacion.moneda?.trim().toUpperCase() === monedaFuncional;
	// Sin conversion persistida y en la misma moneda, el valor funcional es el
	// propio monto; en moneda distinta la falta de conversion es una anomalia
	// que el motor debe rechazar (falla cerrado).
	const montoFuncional =
		params.functionalAmount !== undefined
			? params.functionalAmount
			: (conciliacion.montoConvertido ?? (mismaMoneda ? conciliacion.monto : null));
	const tasaCambio =
		params.exchangeRate !== undefined ? params.exchangeRate : conciliacion.tasaCambio ?? null;
	const huellaFx =
		params.fxEvidenceFingerprint !== undefined
			? params.fxEvidenceFingerprint
			: conciliacion.fxEvidenceFingerprint ?? null;

	const base: SettlementEventParams = {
		reconciliationId: conciliacion.reconciliacionId,
		amount: conciliacion.monto,
		currency: conciliacion.moneda,
		functionalAmount: montoFuncional,
		functionalCurrency: monedaFuncional,
		exchangeRate: tasaCambio,
		fxEvidenceFingerprint: huellaFx,
		treasuryAccountType: params.treasuryAccountType ?? null,
		fecha: conciliacion.fechaReconciliacion,
		...(params.referencia == null ? {} : { reference: params.referencia }),
		...(params.descripcion == null ? {} : { descripcion: params.descripcion }),
	};

	const evento =
		params.tipo === 'COBRO_CXC' ? buildCobroCxcEvent(base) : buildPagoCxpEvent(base);

	return postEvento(tx, ctx, evento, { modo });
}
