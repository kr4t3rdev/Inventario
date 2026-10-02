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
 * @description Fórmula única del saldo neto de una cuenta por cobrar (tarea
 * 2.6): deuda menos pagado, nunca negativo. Todos los lectores del cupo la
 * comparten — `saldoVivoCliente`, `validarCreditoOrigen` y la edición manual
 * de CxC — para que ninguna decisión de crédito use una variante propia.
 * @param {number | string | null | undefined} montoDeuda - Deuda total (Decimal de Prisma aceptado).
 * @param {number | string | null | undefined} montoPagado - Total ya pagado.
 * @returns {number} Saldo neto (nunca negativo).
 */
export function saldoNetoCuenta(
	montoDeuda: number | string | null | undefined,
	montoPagado: number | string | null | undefined,
): number {
	const deuda = montoDeuda == null ? 0 : Number(montoDeuda);
	const pagado = montoPagado == null ? 0 : Number(montoPagado);
	return Math.max(deuda - pagado, 0);
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
		total += saldoNetoCuenta(c.montoDeuda, c.montoPagado);
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
