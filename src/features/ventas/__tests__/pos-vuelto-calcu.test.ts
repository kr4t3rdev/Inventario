/**
 * @description Tests del cálculo puro del vuelto en el cobro (VC-T1).
 */
import { describe, it, expect } from 'vitest';
import {
	calcularVuelto,
	validarCobro,
} from '@/features/ventas/services/pos-vuelto-calcu';

describe('calcularVuelto (VC-T1)', () => {
	it('devuelve el vuelto cuando el recibido supera lo cobrado', () => {
		expect(calcularVuelto('EFECTIVO', 4800, 5000)).toBe(200);
	});

	it('devuelve 0 cuando el recibido es exacto', () => {
		expect(calcularVuelto('EFECTIVO', 4800, 4800)).toBe(0);
	});

	it('no aplica a tarjeta, transferencia ni crédito', () => {
		expect(calcularVuelto('TARJETA', 4800, 4800)).toBeNull();
		expect(calcularVuelto('TRANSFERENCIA', 4800, 4800)).toBeNull();
		expect(calcularVuelto('CREDITO', 4800, 4800)).toBeNull();
	});

	it('sin recibido (mobile antiguo) no hay vuelto documentado', () => {
		expect(calcularVuelto('EFECTIVO', 4800, null)).toBeNull();
		expect(calcularVuelto('EFECTIVO', 4800, undefined)).toBeNull();
	});

	it('MIXTO: el vuelto se calcula solo sobre la porción en efectivo', () => {
		expect(calcularVuelto('MIXTO', 2000, 2500)).toBe(500);
	});
});

describe('validarCobro (VC-T1)', () => {
	it('acepta recibido >= monto y devuelve el cambio', () => {
		expect(validarCobro({
			metodoPago: 'EFECTIVO',
			montoEfectivo: 4800,
			montoRecibidoEfectivo: 5000,
		})).toEqual({ ok: true, cambio: 200 });
	});

	it('rechaza cuando el recibido no alcanza la porción en efectivo', () => {
		expect(validarCobro({
			metodoPago: 'MIXTO',
			montoEfectivo: 2000,
			montoRecibidoEfectivo: 1500,
		})).toEqual({ ok: false, codigo: 'RECIBIDO_INSUFICIENTE' });
	});

	it('sin recibido el cobro pasa igual (compatibilidad mobile antiguo)', () => {
		expect(validarCobro({
			metodoPago: 'EFECTIVO',
			montoEfectivo: 4800,
			montoRecibidoEfectivo: null,
		})).toEqual({ ok: true, cambio: null });
	});

	it('rechaza recibido negativo', () => {
		expect(validarCobro({
			metodoPago: 'EFECTIVO',
			montoEfectivo: 100,
			montoRecibidoEfectivo: -1,
		})).toEqual({ ok: false, codigo: 'RECIBIDO_INSUFICIENTE' });
	});
});
