/**
 * @description Tests del resolver unificado de precio de venta (LP-0).
 * Cadena: lista del cliente > lista del punto de venta > precio base.
 */
import { describe, expect, it } from 'vitest';
import { resolvePrecioVenta } from '@/features/ventas/services/precio-venta-resolver';

describe('resolvePrecioVenta', () => {
	const precios = [
		{ listaPrecioId: 'lista-pv', precio: 900 },
		{ listaPrecioId: 'lista-cliente', precio: 800 },
	];

	it('prioriza la lista del cliente sobre la del punto de venta', () => {
		const r = resolvePrecioVenta({
			precioBase: 1000,
			precios,
			pvListaId: 'lista-pv',
			clienteListaId: 'lista-cliente',
		});
		expect(r).toEqual({ precio: 800, fuente: 'CLIENTE' });
	});

	it('cae a la lista del punto de venta si el cliente no tiene entrada', () => {
		const r = resolvePrecioVenta({
			precioBase: 1000,
			precios,
			pvListaId: 'lista-pv',
			clienteListaId: 'lista-sin-entrada',
		});
		expect(r).toEqual({ precio: 900, fuente: 'PV' });
	});

	it('usa la lista del punto de venta cuando no hay lista de cliente', () => {
		const r = resolvePrecioVenta({
			precioBase: 1000,
			precios,
			pvListaId: 'lista-pv',
			clienteListaId: null,
		});
		expect(r).toEqual({ precio: 900, fuente: 'PV' });
	});

	it('cae al precio base cuando ninguna lista tiene entrada', () => {
		const r = resolvePrecioVenta({
			precioBase: 1000,
			precios,
			pvListaId: 'lista-desconocida',
			clienteListaId: 'otra-desconocida',
		});
		expect(r).toEqual({ precio: 1000, fuente: 'BASE' });
	});

	it('cae al precio base con precios vacíos o ausencia total de listas', () => {
		expect(
			resolvePrecioVenta({ precioBase: 1000, precios: [], pvListaId: null, clienteListaId: null }),
		).toEqual({ precio: 1000, fuente: 'BASE' });
	});

	it('la lista del cliente manda aunque el producto no tenga entrada en la del PV', () => {
		const r = resolvePrecioVenta({
			precioBase: 1000,
			precios: [{ listaPrecioId: 'lista-cliente', precio: 750 }],
			pvListaId: 'lista-pv',
			clienteListaId: 'lista-cliente',
		});
		expect(r).toEqual({ precio: 750, fuente: 'CLIENTE' });
	});
});
