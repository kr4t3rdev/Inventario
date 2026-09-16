/**
 * @description Módulo puro del vuelto del POS (VC). Sin I/O: funciones sobre
 * enteros en centavos. La regla: el vuelto solo existe en pagos con efectivo y
 * equivale a (recibido − a cobrar en efectivo) ≥ 0. Tarjeta/transferencia/
 * crédito nunca llevan vuelto.
 */

export type MetodoPagoPos =
	| 'EFECTIVO'
	| 'TARJETA'
	| 'TRANSFERENCIA'
	| 'CREDITO'
	| 'MIXTO';

export type ResultadoCobro =
	| { ok: true; cambio: number | null }
	| { ok: false; codigo: 'RECIBIDO_INSUFICIENTE' };

/**
 * @description Vuelto a entregar (centavos). Devuelve null cuando el método no
 * es de efectivo o el recibido no se capturó (compat. mobile antiguo).
 * @param {MetodoPagoPos} metodoPago - Método de pago de la venta.
 * @param {number} montoEfectivo - Porción cobrada en efectivo (centavos).
 * @param {number | null | undefined} montoRecibido - Recibido en efectivo.
 * @returns {number | null} Cambio en centavos o null si no aplica.
 */
export function calcularVuelto(
	metodoPago: MetodoPagoPos,
	montoEfectivo: number,
	montoRecibido: number | null | undefined,
): number | null {
	if (metodoPago !== 'EFECTIVO' && metodoPago !== 'MIXTO') return null;
	if (montoRecibido == null) return null;
	const cambio = montoRecibido - montoEfectivo;
	return cambio >= 0 ? cambio : 0;
}

/**
 * @description Valida un cobro: la porción en efectivo no puede superar lo
 * recibido y el vuelto nunca es negativo.
 * @param {object} params - Método, porción en efectivo y recibido (ambos centavos).
 * @returns {ResultadoCobro} Resultado con el cambio o el código de rechazo.
 */
export function validarCobro(params: {
	metodoPago: MetodoPagoPos;
	montoEfectivo: number;
	montoRecibidoEfectivo: number | null | undefined;
}): ResultadoCobro {
	const { metodoPago, montoEfectivo, montoRecibidoEfectivo } = params;
	if (metodoPago !== 'EFECTIVO' && metodoPago !== 'MIXTO') {
		return { ok: true, cambio: null };
	}
	if (montoRecibidoEfectivo == null) {
		return { ok: true, cambio: null };
	}
	if (montoRecibidoEfectivo < 0 || montoRecibidoEfectivo < montoEfectivo) {
		return { ok: false, codigo: 'RECIBIDO_INSUFICIENTE' };
	}
	return { ok: true, cambio: montoRecibidoEfectivo - montoEfectivo };
}
