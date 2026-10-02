/**
 * @description Tests de la regla pura del saldo vivo del cliente (CRM-T1).
 * El saldo vivo = Σ(saldo pendiente) de las cuentas por cobrar no anuladas del
 * cliente. Nunca negativo; null-safe.
 */
import { describe, it, expect } from 'vitest';
import {
	saldoNetoCuenta,
	saldoVivoCliente,
	superaLimiteCredito,
} from '@/features/crm/services/credito-calculo';

describe('saldoNetoCuenta (fórmula única del saldo, 2.6)', () => {
	it('deuda menos pagado, nunca negativo', () => {
		expect(saldoNetoCuenta(100, 40)).toBe(60);
		expect(saldoNetoCuenta(100, 100)).toBe(0);
	});

	it('sobrepago cae a 0 y valores null/undefined a 0', () => {
		expect(saldoNetoCuenta(100, 150)).toBe(0);
		expect(saldoNetoCuenta(null, undefined)).toBe(0);
		expect(saldoNetoCuenta(100, null)).toBe(100);
	});

	it('acepta decimales como string de Prisma sin perder centavos', () => {
		expect(saldoNetoCuenta('2000.01' as never, '400.25' as never)).toBeCloseTo(1599.76, 2);
	});
});

describe('saldo vivo del cliente (CRM-T1)', () => {
	it('sin CxC el saldo vivo es 0', () => {
		expect(saldoVivoCliente([])).toBe(0);
	});

	it('suma solo el saldo pendiente (deuda - pagado) de CxC abiertas', () => {
		const cuentas = [
			{ montoDeuda: 5000, montoPagado: 2000, estado: 'PENDIENTE' },
			{ montoDeuda: 2000, montoPagado: 2000, estado: 'PAGADA' }, // cerrada → no cuenta
			{ montoDeuda: 3000, montoPagado: 1000, estado: 'PARCIAL' },
			{ montoDeuda: 500, montoPagado: 0, estado: 'ANULADA' }, // anulada → no cuenta
		];
		expect(saldoVivoCliente(cuentas as never)).toBe(5000);
	});

	it('una CxC sobrepagada no baja el saldo por debajo de 0', () => {
		const cuentas = [{ montoDeuda: 100, montoPagado: 150, estado: 'PAGADA' }];
		expect(saldoVivoCliente(cuentas as never)).toBe(0);
	});
});

describe('superaLimiteCredito', () => {
	it('sin límite configurado nunca bloquea', () => {
		expect(superaLimiteCredito({ saldoVivo: 1_000_000, montoRequerido: 1_000_000, limiteCredito: null })).toBe(false);
	});

	it('pasado del límite bloquea', () => {
		expect(superaLimiteCredito({ saldoVivo: 700, montoRequerido: 400, limiteCredito: 1000 })).toBe(true);
	});

	it('en el límite exacto no bloquea', () => {
		expect(superaLimiteCredito({ saldoVivo: 700, montoRequerido: 300, limiteCredito: 1000 })).toBe(false);
	});
});
