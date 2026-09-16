/**
 * @description Tests del motor puro de devoluciones (DNC-T2): disponibilidad por
 * ítem, prorrateo acotado del descuento de la venta y cascada financiera.
 */
import { describe, it, expect } from 'vitest';
/**
 * @description Ejecuta fn y verifica que lanza ActionError con el código dado.
 */
function expectCode(fn: () => unknown, code: string) {
	try {
		fn();
	} catch (e) {
		expect(e).toMatchObject({ code });
		return;
	}
	throw new Error(`Debió lanzar con código ${code}`);
}

import {
	calcularDisponibles,
	calcularMontosDevolucion,
	resolverTratamientoFinanciero,
} from '@/features/ventas/services/devolucion-calculo';

describe('calcularDisponibles', () => {
	it('sin devoluciones previas, lo disponible es lo vendido', () => {
		const r = calcularDisponibles([{ id: 'vi-1', cantidad: 5 }], []);
		expect(r.get('vi-1')).toBe(5);
	});

	it('resta las devoluciones previas del mismo ítem', () => {
		const r = calcularDisponibles(
			[{ id: 'vi-1', cantidad: 5 }],
			[{ ventaItemId: 'vi-1', cantidad: 2 }],
		);
		expect(r.get('vi-1')).toBe(3);
	});

	it('no mezcla ítems distintos', () => {
		const r = calcularDisponibles(
			[
				{ id: 'vi-1', cantidad: 5 },
				{ id: 'vi-2', cantidad: 1 },
			],
			[{ ventaItemId: 'vi-1', cantidad: 5 }],
		);
		expect(r.get('vi-1')).toBe(0);
		expect(r.get('vi-2')).toBe(1);
	});
});

describe('calcularMontosDevolucion', () => {
	const itemsVenta = [
		{ id: 'vi-1', cantidad: 3, precioUnitario: 100, total: 300 },
		{ id: 'vi-2', cantidad: 1, precioUnitario: 200, total: 200 },
	]; // bruto 500

	it('devuelve subtotal/total sin descuento cuando la venta no tiene', () => {
		const r = calcularMontosDevolucion({
			itemsVenta,
			descuentoVenta: 0,
			descuentoYaDevuelto: 0,
			devolucionesPrevias: [],
			seleccion: [{ ventaItemId: 'vi-1', cantidad: 2 }],
		});
		expect(r.subtotal).toBe(200);
		expect(r.descuento).toBe(0);
		expect(r.total).toBe(200);
		expect(r.items).toHaveLength(1);
	});

	it('consolida ítems repetidos en la selección', () => {
		const r = calcularMontosDevolucion({
			itemsVenta,
			descuentoVenta: 0,
			descuentoYaDevuelto: 0,
			devolucionesPrevias: [],
			seleccion: [
				{ ventaItemId: 'vi-1', cantidad: 1 },
				{ ventaItemId: 'vi-1', cantidad: 2 },
			],
		});
		expect(r.items).toHaveLength(1);
		expect(r.items[0].cantidad).toBe(3);
	});

	it('rechaza devolver más de lo disponible', () => {
		expectCode(() =>
			calcularMontosDevolucion({
				itemsVenta,
				descuentoVenta: 0,
				descuentoYaDevuelto: 0,
				devolucionesPrevias: [{ ventaItemId: 'vi-1', cantidad: 2 }],
				seleccion: [{ ventaItemId: 'vi-1', cantidad: 2 }],
			}),
			'CANTIDAD_EXCEDIDA');
	});

	it('rechaza una selección vacía', () => {
		expectCode(() =>
			calcularMontosDevolucion({
				itemsVenta,
				descuentoVenta: 0,
				descuentoYaDevuelto: 0,
				devolucionesPrevias: [],
				seleccion: [],
			}),
			'VALIDATION_ERROR');
	});

	it('rechaza cantidades no enteras', () => {
		expectCode(() =>
			calcularMontosDevolucion({
				itemsVenta,
				descuentoVenta: 0,
				descuentoYaDevuelto: 0,
				devolucionesPrevias: [],
				seleccion: [{ ventaItemId: 'vi-1', cantidad: 1.5 }],
			}),
			'VALIDATION_ERROR');
	});

	it('rechaza un ítem que no pertenece a la venta', () => {
		expectCode(() =>
			calcularMontosDevolucion({
				itemsVenta,
				descuentoVenta: 0,
				descuentoYaDevuelto: 0,
				devolucionesPrevias: [],
				seleccion: [{ ventaItemId: 'vi-ajena', cantidad: 1 }],
			}),
			'ITEM_NO_PERTENECE');
	});

	it('prorratea el descuento de la venta con floor', () => {
		// descuento 100 sobre bruto 500; se devuelve subtotal 250 → floor(100*250/500)=50
		const r = calcularMontosDevolucion({
			itemsVenta,
			descuentoVenta: 100,
			descuentoYaDevuelto: 0,
			devolucionesPrevias: [],
			seleccion: [{ ventaItemId: 'vi-1', cantidad: 3 }],
		});
		expect(r.subtotal).toBe(300);
		expect(r.descuento).toBe(60); // floor(100*300/500)
		expect(r.total).toBe(240);
	});

	it('el descuento aplicado nunca supera el subtotal devuelto (total ≥ 0)', () => {
		// bruto 3 con descuento 100 (degenerado): floor(100*1/3)=33 > subtotal devuelto 1
		const r = calcularMontosDevolucion({
			itemsVenta: [{ id: 'vi-1', cantidad: 3, precioUnitario: 1, total: 3 }],
			descuentoVenta: 100,
			descuentoYaDevuelto: 0,
			devolucionesPrevias: [],
			seleccion: [{ ventaItemId: 'vi-1', cantidad: 1 }],
		});
		expect(r.subtotal).toBe(1);
		expect(r.descuento).toBe(1); // cap por subtotal
		expect(r.total).toBe(0);
	});

	it('el descuento prorrateado nunca excede lo que queda por devolver', () => {
		// ya se devolvieron 90 de 100 en descuento; solo quedan 10
		const r = calcularMontosDevolucion({
			itemsVenta,
			descuentoVenta: 100,
			descuentoYaDevuelto: 90,
			devolucionesPrevias: [],
			seleccion: [{ ventaItemId: 'vi-1', cantidad: 1 }],
		});
		expect(r.descuento).toBe(10);
	});

	it('con bruto 0 no prorratea nada', () => {
		const r = calcularMontosDevolucion({
			itemsVenta: [{ id: 'vi-1', cantidad: 1, precioUnitario: 0, total: 0 }],
			descuentoVenta: 100,
			descuentoYaDevuelto: 0,
			devolucionesPrevias: [],
			seleccion: [{ ventaItemId: 'vi-1', cantidad: 1 }],
		});
		expect(r.descuento).toBe(0);
		expect(r.total).toBe(0);
	});

	it('N devoluciones parciales nunca superan el descuento original', () => {
		// bruto 500, descuento 100; devolvemos los 5 "quintos" en 5 llamadas
		let yaDevuelto = 0;
		for (let i = 0; i < 5; i++) {
			const r = calcularMontosDevolucion({
				itemsVenta: [
					{ id: 'vi-1', cantidad: 5, precioUnitario: 100, total: 500 },
				],
				descuentoVenta: 100,
				descuentoYaDevuelto: yaDevuelto,
				devolucionesPrevias: [{ ventaItemId: 'vi-1', cantidad: i }],
				seleccion: [{ ventaItemId: 'vi-1', cantidad: 1 }],
			});
			yaDevuelto += r.descuento;
		}
		expect(yaDevuelto).toBeLessThanOrEqual(100);
	});
});

describe('resolverTratamientoFinanciero', () => {
	it('la CxC absorbe primero cuando cubre todo', () => {
		const r = resolverTratamientoFinanciero({
			total: 400,
			saldoCxc: 500,
			preferencia: 'SALDO_FAVOR',
			hayTurnoAbierto: true,
			puedeReembolsar: true,
			hayCliente: true,
		});
		expect(r).toEqual({ aplicadoCxc: 400, saldoFavor: 0, reembolso: 0 });
	});

	it('CxC parcial + excedente a saldo a favor', () => {
		const r = resolverTratamientoFinanciero({
			total: 500,
			saldoCxc: 300,
			preferencia: 'SALDO_FAVOR',
			hayTurnoAbierto: false,
			puedeReembolsar: false,
			hayCliente: true,
		});
		expect(r).toEqual({ aplicadoCxc: 300, saldoFavor: 200, reembolso: 0 });
	});

	it('sin CxC y con turno abierto se permite el reembolso', () => {
		const r = resolverTratamientoFinanciero({
			total: 250,
			saldoCxc: 0,
			preferencia: 'REEMBOLSO_EFECTIVO',
			hayTurnoAbierto: true,
			puedeReembolsar: true,
			hayCliente: true,
		});
		expect(r).toEqual({ aplicadoCxc: 0, saldoFavor: 0, reembolso: 250 });
	});

	it('rechaza reembolso sin turno abierto', () => {
		expectCode(() =>
			resolverTratamientoFinanciero({
				total: 100,
				saldoCxc: 0,
				preferencia: 'REEMBOLSO_EFECTIVO',
				hayTurnoAbierto: false,
				puedeReembolsar: true,
			}),
			'REEMBOLSO_SIN_TURNO');
	});

	it('rechaza reembolso sin permiso', () => {
		expectCode(() =>
			resolverTratamientoFinanciero({
				total: 100,
				saldoCxc: 0,
				preferencia: 'REEMBOLSO_EFECTIVO',
				hayTurnoAbierto: true,
				puedeReembolsar: false,
				hayCliente: true,
			}),
			'FORBIDDEN');
	});

	it('sin cliente y con excedente, saldo a favor se rechaza orientando a reembolso', () => {
		expectCode(() =>
			resolverTratamientoFinanciero({
				total: 100,
				saldoCxc: 0,
				preferencia: 'SALDO_FAVOR',
				hayTurnoAbierto: true,
				puedeReembolsar: true,
				hayCliente: false,
			}),
			'CLIENTE_REQUERIDO');
	});

	it('la cascada siempre conserva el total', () => {
		const casos = [
			{ total: 700, saldoCxc: 700 },
			{ total: 700, saldoCxc: 200 },
			{ total: 700, saldoCxc: 0 },
		];
		for (const c of casos) {
			const r = resolverTratamientoFinanciero({
				...c,
				preferencia: 'SALDO_FAVOR',
				hayTurnoAbierto: true,
				puedeReembolsar: true,
				hayCliente: true,
			});
			expect(r.aplicadoCxc + r.saldoFavor + r.reembolso).toBe(c.total);
		}
	});
});
