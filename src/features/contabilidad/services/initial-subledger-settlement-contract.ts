import { z } from 'zod';

/**
 * @description Contrato de liquidación de submayor inicial externa.
 *
 * El cobro y el pago se liquidan siempre en la moneda de la obligación
 * (decisión 3): no hay campo de moneda de pago. La tasa no la declara el
 * usuario: se resuelve del catálogo a la fecha efectiva (decisión 4).
 * La `referencia` es la clave de idempotencia de la operación: en el cobro
 * alimenta `ReconciliacionVenta.idempotencyKey` y en el pago
 * `PagoCuentaPorPagar.numeroTransaccion`.
 */
const decimalAmount = z
	.string()
	.regex(/^\d+(?:\.\d{1,4})?$/, 'El monto debe ser un decimal positivo de hasta 4 decimales')
	.refine((value) => Number(value) > 0, 'El monto debe ser mayor que cero');

const baseSettlementInput = {
	cuentaId: z.string().min(1, 'La cuenta bancaria es obligatoria'),
	monto: decimalAmount,
	fechaEfectiva: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha efectiva debe ser yyyy-mm-dd')
		.refine((value) => {
			const [year, month, day] = value.split('-').map(Number);
			const parsed = new Date(Date.UTC(year, month - 1, day));
			return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
		}, 'La fecha efectiva no es una fecha válida'),
	referencia: z.string().min(1, 'La referencia es obligatoria').max(100),
	observaciones: z.string().max(500).optional(),
};

export const settleInitialReceivableInput = z.object({
	...baseSettlementInput,
	cuentaPorCobrarId: z.string().min(1, 'La cuenta por cobrar es obligatoria'),
	tipoPagoId: z.string().min(1, 'El tipo de pago es obligatorio'),
});

export const settleInitialPayableInput = z.object({
	...baseSettlementInput,
	cuentaPorPagarId: z.string().min(1, 'La cuenta por pagar es obligatoria'),
	cuentaProveedor: z.string().max(100).optional(),
});

export type SettleInitialReceivableInput = z.infer<typeof settleInitialReceivableInput>;
export type SettleInitialPayableInput = z.infer<typeof settleInitialPayableInput>;
