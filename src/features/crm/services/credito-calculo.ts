/**
 * @description Regla pura del CRM operativo (Gap 6): saldo vivo del cliente y
 * verificación del tope de crédito.
 *
 * La fuente única es la CxC no anulada del cliente: el saldo vivo es la suma
 * del saldo pendiente (montoDeuda − montoPagado) de cada cuenta.
 * Las devoluciones del DNC ya descuentan del CxC; las ventas al contado con
 * cliente no entran (no son "crédito").
 */

export interface CuentaVivaParaSaldo {
	montoDeuda: number;
	montoPagado: number;
	estado: string;
}

/**
 * @description Suma el saldo pendiente de las CxC activas del cliente.
 * Reglas: sobrepago (montoPagado > montoDeuda) cuenta 0; CxC ANULADA queda fuera.
 * @param {CuentaVivaParaSaldo[]} cuentas - CxC del cliente.
 * @returns {number} Saldo vivo (nunca negativo).
 */
export function saldoVivoCliente(cuentas: readonly CuentaVivaParaSaldo[]): number {
	let total = 0;
	for (const c of cuentas) {
		if (c.estado === 'ANULADA') continue;
		const saldo = Number(c.montoDeuda) - Number(c.montoPagado);
		if (saldo > 0) total += saldo;
	}
	return total;
}

/**
 * @description Decide si un nuevo crédito sobrepasa el tope del cliente.
 * El límite nulo significa sin tope. En el límite justo (igual) no bloquea.
 * @param {object} params - saldo vivo actual + monto nuevo + límite nullable.
 * @returns {boolean} true si el tope quedaría superado.
 */
export function superaLimiteCredito(params: {
	saldoVivo: number;
	montoRequerido: number;
	limiteCredito: number | null;
}): boolean {
	if (params.limiteCredito == null) return false;
	return params.saldoVivo + params.montoRequerido > params.limiteCredito;
}
