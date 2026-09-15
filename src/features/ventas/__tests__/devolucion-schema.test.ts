/**
 * @description Tests del schema Zod de devoluciones de venta (DNC-T1).
 */
import { describe, it, expect } from 'vitest';
import { registrarDevolucionSchema } from '@/features/ventas/schemas';

const valido = {
	ventaId: 'v-1',
	items: [{ ventaItemId: 'vi-1', cantidad: 1 }],
	motivo: 'Producto defectuoso',
	preferenciaFinanciera: 'SALDO_FAVOR',
	idempotencyKey: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
};

describe('registrarDevolucionSchema (DNC-T1)', () => {
	it('acepta una devolución válida con saldo a favor', () => {
		const r = registrarDevolucionSchema.safeParse(valido);
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.preferenciaFinanciera).toBe('SALDO_FAVOR');
	});

	it('el motivo es obligatorio (mínimo 3 caracteres)', () => {
		expect(registrarDevolucionSchema.safeParse({ ...valido, motivo: '' }).success).toBe(false);
		expect(registrarDevolucionSchema.safeParse({ ...valido, motivo: 'ab' }).success).toBe(false);
	});

	it('rechaza cantidades cero o negativas', () => {
		const r0 = registrarDevolucionSchema.safeParse({
			...valido,
			items: [{ ventaItemId: 'vi-1', cantidad: 0 }],
		});
		expect(r0.success).toBe(false);
	});

	it('exige al menos un ítem', () => {
		expect(registrarDevolucionSchema.safeParse({ ...valido, items: [] }).success).toBe(false);
	});

	it('exige idempotencyKey uuid válido', () => {
		expect(
			registrarDevolucionSchema.safeParse({ ...valido, idempotencyKey: 'no-uuid' }).success,
		).toBe(false);
	});

	it('solo admite las preferencias financieras conocidas', () => {
		expect(
			registrarDevolucionSchema.safeParse({
				...valido,
				preferenciaFinanciera: 'EFECTIVO_YA',
			}).success,
		).toBe(false);
	});
});
