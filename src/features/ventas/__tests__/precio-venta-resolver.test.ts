/**
 * @description Tests del resolver unificado de precio de venta (LP-0 + LP-1.2).
 * Cadena: lista del cliente > lista del punto de venta > lista default del
 * tenant > precio base (H3: esDefault como fallback intermedio).
 */
import { describe, expect, it } from 'vitest';
import { resolvePrecioVenta } from '@/features/ventas/services/precio-venta-resolver';

describe('resolvePrecioVenta', () => {
	const precios = [
		{ listaPrecioId: 'lista-pv', precio: 900 },
		{ listaPrecioId: 'lista-cliente', precio: 800 },
		{ listaPrecioId: 'lista-default', precio: 850 },
	];

	it('prioriza la lista del cliente sobre la del punto de venta', () => {
		const r = resolvePrecioVenta({
			precioBase: 1000,
			precios,
			pvListaId: 'lista-pv',
			clienteListaId: 'lista-cliente',
			defaultListaId: null,
		});
		expect(r).toEqual({ precio: 800, fuente: 'CLIENTE' });
	});

	it('cae a la lista del punto de venta si el cliente no tiene entrada', () => {
		const r = resolvePrecioVenta({
			precioBase: 1000,
			precios,
			pvListaId: 'lista-pv',
			clienteListaId: 'lista-sin-entrada',
			defaultListaId: null,
		});
		expect(r).toEqual({ precio: 900, fuente: 'PV' });
	});

	it('usa la lista del punto de venta cuando no hay lista de cliente', () => {
		const r = resolvePrecioVenta({
			precioBase: 1000,
			precios,
			pvListaId: 'lista-pv',
			clienteListaId: null,
			defaultListaId: null,
		});
		expect(r).toEqual({ precio: 900, fuente: 'PV' });
	});

	it('cae al precio base cuando ninguna lista tiene entrada', () => {
		const r = resolvePrecioVenta({
			precioBase: 1000,
			precios,
			pvListaId: 'lista-desconocida',
			clienteListaId: 'otra-desconocida',
			defaultListaId: 'lista-tampoco-existe',
		});
		expect(r).toEqual({ precio: 1000, fuente: 'BASE' });
	});

	it('cae al precio base con precios vacíos o ausencia total de listas', () => {
		expect(
			resolvePrecioVenta({ precioBase: 1000, precios: [], pvListaId: null, clienteListaId: null, defaultListaId: null }),
		).toEqual({ precio: 1000, fuente: 'BASE' });
	});

	it('la lista del cliente manda aunque el producto no tenga entrada en la del PV', () => {
		const r = resolvePrecioVenta({
			precioBase: 1000,
			precios: [{ listaPrecioId: 'lista-cliente', precio: 750 }],
			pvListaId: 'lista-pv',
			clienteListaId: 'lista-cliente',
			defaultListaId: null,
		});
		expect(r).toEqual({ precio: 750, fuente: 'CLIENTE' });
	});

	describe('lista default del tenant (LP-1.2 / H3)', () => {
		it('aplica la lista default cuando el PV tiene lista pero el producto no tiene entrada', () => {
			const r = resolvePrecioVenta({
				precioBase: 1000,
				precios: [{ listaPrecioId: 'lista-default', precio: 850 }],
				pvListaId: 'lista-pv',
				clienteListaId: null,
				defaultListaId: 'lista-default',
			});
			expect(r).toEqual({ precio: 850, fuente: 'DEFAULT' });
		});

		it('aplica la lista default cuando el PV no tiene lista asignada', () => {
			const r = resolvePrecioVenta({
				precioBase: 1000,
				precios,
				pvListaId: null,
				clienteListaId: null,
				defaultListaId: 'lista-default',
			});
			expect(r).toEqual({ precio: 850, fuente: 'DEFAULT' });
		});

		it('la entrada del PV gana sobre la lista default', () => {
			const r = resolvePrecioVenta({
				precioBase: 1000,
				precios,
				pvListaId: 'lista-pv',
				clienteListaId: null,
				defaultListaId: 'lista-default',
			});
			expect(r).toEqual({ precio: 900, fuente: 'PV' });
		});

		it('la lista del cliente gana sobre la lista default', () => {
			const r = resolvePrecioVenta({
				precioBase: 1000,
				precios,
				pvListaId: null,
				clienteListaId: 'lista-cliente',
				defaultListaId: 'lista-default',
			});
			expect(r).toEqual({ precio: 800, fuente: 'CLIENTE' });
		});

		it('cae al precio base si la lista default no tiene entrada para el producto', () => {
			const r = resolvePrecioVenta({
				precioBase: 1000,
				precios: [{ listaPrecioId: 'lista-pv', precio: 900 }],
				pvListaId: 'lista-desconocida',
				clienteListaId: null,
				defaultListaId: 'lista-default',
			});
			expect(r).toEqual({ precio: 1000, fuente: 'BASE' });
		});

		it('sin lista default configurada la cadena se mantiene cliente > PV > base', () => {
			const r = resolvePrecioVenta({
				precioBase: 1000,
				precios,
				pvListaId: 'lista-pv',
				clienteListaId: null,
				defaultListaId: null,
			});
			expect(r).toEqual({ precio: 900, fuente: 'PV' });
		});
	});
});
