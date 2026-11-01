/**
 * @description Construye los eventos formales de liquidación de cuentas por
 * cobrar y por pagar (COBRO_CXC / PAGO_CXP), preservando la valoracion exacta
 * de la escritura operativa.
 *
 * Igual que el builder de pagos cash, el constructor NO recalcula moneda ni
 * tipo de cambio: consume la valoracion ya persistida en la conciliacion, de
 * modo que el asiento formal y la fila operativa comparten la misma evidencia
 * FX.
 */

import type { DecimalInput } from '../services/posting-engine';

export type SettlementDecimalInput = DecimalInput;

/** Origen operativo del evento: la conciliacion que lo produjo. */
export type SettlementOriginType =
	| 'reconciliacion_venta'
	| 'reconciliacion_gasto'
	| 'reconciliacion_servicio';

export interface SettlementEvent {
	tipo: 'COBRO_CXC' | 'PAGO_CXP' | 'COBRO_SERVICIO';
	fecha: Date;
	descripcion: string;
	origen: { tipo: SettlementOriginType; id: string };
	monto: SettlementDecimalInput;
	moneda: string;
	montoFuncional: SettlementDecimalInput | null;
	monedaFuncional: string | null;
	tasaCambio: SettlementDecimalInput | null;
	fxEvidenceFingerprint: string | null;
	medioCobro?: 'CAJA' | 'BANCOS';
	referencia?: string;
	auxiliares?: { diferenciaFx?: SettlementDecimalInput };
}

export interface SettlementEventParams {
	/** Identificador de la conciliacion que origina el evento. */
	reconciliationId: string;
	/** Monto en moneda original (el de la conciliacion). */
	amount: SettlementDecimalInput;
	/** Moneda original del cobro o pago. */
	currency: string;
	/** Monto ya convertido a moneda funcional (null si el writer no lo persistio). */
	functionalAmount?: SettlementDecimalInput | null;
	/** Moneda funcional del tenant (persistida o de la politica contable). */
	functionalCurrency?: string | null;
	/** Tasa aplicada en la conciliacion. */
	exchangeRate?: SettlementDecimalInput | null;
	/** Huella de la evidencia FX (obligatoria si la moneda difiere de la funcional). */
	fxEvidenceFingerprint?: string | null;
	/** Tipo de la cuenta bancaria emisora (EFECTIVO = CAJA, resto = BANCOS). */
	treasuryAccountType?: string | null;
	/** Fecha operativa de la conciliacion. */
	fecha: Date;
	/** Referencia externa (idempotencia, numero de operacion, etc.). */
	reference?: string;
	/** Descripcion legible del evento. */
	descripcion?: string;
}

/**
 * @description Deriva el medio de cobro desde el tipo de la cuenta bancaria.
 * @param {string | null | undefined} treasuryAccountType - Tipo de la cuenta bancaria.
 * @returns {'CAJA' | 'BANCOS'} CAJA para efectivo, BANCOS para el resto.
 */
export function derivarMedioCobro(treasuryAccountType?: string | null): 'CAJA' | 'BANCOS' {
	return treasuryAccountType === 'EFECTIVO' ? 'CAJA' : 'BANCOS';
}

/**
 * @description Construye un evento de liquidacion (cobro o pago) a partir de una
 * conciliacion ya persistida.
 * @param {SettlementEventParams} params - Conciliacion y evidencia ya persistidas.
 * @param {'COBRO_CXC' | 'PAGO_CXP'} tipo - Plantilla formal a emitir.
 * @param {SettlementOriginType} origenTipo - Tipo de conciliacion de origen.
 * @returns {SettlementEvent} Evento apto para el motor formal.
 */
export function buildSettlementEvent(
	params: SettlementEventParams,
	tipo: 'COBRO_CXC' | 'PAGO_CXP' | 'COBRO_SERVICIO',
	origenTipo: SettlementOriginType,
): SettlementEvent {
	const fingerprint = params.fxEvidenceFingerprint ?? null;
	return {
		tipo,
		fecha: params.fecha,
		descripcion:
			params.descripcion ??
			(tipo === 'COBRO_CXC'
				? 'Cobro de cuenta por cobrar'
				: tipo === 'COBRO_SERVICIO'
					? 'Cobro de servicio'
					: 'Pago de cuenta por pagar'),
		origen: { tipo: origenTipo, id: params.reconciliationId },
		monto: params.amount,
		moneda: params.currency,
		montoFuncional: params.functionalAmount ?? null,
		monedaFuncional: params.functionalCurrency ?? null,
		tasaCambio: params.exchangeRate ?? null,
		fxEvidenceFingerprint: fingerprint,
		...(params.treasuryAccountType == null
			? {}
			: { medioCobro: derivarMedioCobro(params.treasuryAccountType) }),
		...(params.reference == null ? {} : { referencia: params.reference }),
		// Sin diferencia FX residual: la conciliacion ya contiene el valor
		// funcional valuado con la tasa persistida, por lo que la rama
		// SIN_DIFERENCIA_FX aplica.
		auxiliares: { diferenciaFx: 0 },
	};
}

/**
 * @description Construye el evento formal de un cobro contra cuentas por cobrar.
 * @param {SettlementEventParams} params - Conciliacion de venta ya persistida.
 * @returns {SettlementEvent} Evento COBRO_CXC apto para el motor formal.
 */
export function buildCobroCxcEvent(params: SettlementEventParams): SettlementEvent {
	return buildSettlementEvent(params, 'COBRO_CXC', 'reconciliacion_venta');
}

/**
 * @description Construye el evento formal de un pago contra cuentas por pagar.
 * @param {SettlementEventParams} params - Conciliacion de gasto ya persistida.
 * @returns {SettlementEvent} Evento PAGO_CXP apto para el motor formal.
 */
export function buildPagoCxpEvent(params: SettlementEventParams): SettlementEvent {
	return buildSettlementEvent(params, 'PAGO_CXP', 'reconciliacion_gasto');
}

/**
 * @description Construye el evento formal de un cobro de servicio.
 * @param {SettlementEventParams} params - Conciliación de servicio persistida.
 * @returns {SettlementEvent} Evento COBRO_SERVICIO apto para el motor formal.
 */
export function buildCobroServicioEvent(params: SettlementEventParams): SettlementEvent {
	return buildSettlementEvent(params, 'COBRO_SERVICIO', 'reconciliacion_servicio');
}
