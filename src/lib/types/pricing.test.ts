/**
 * @description Tests del adaptador getPrecioEfectivo (LP-1.3). El precio ya no
 * se resuelve aquí: el adaptador delega en resolvePrecioVenta con la cadena
 * completa cliente > PV > default del tenant > base, usando los ids que viajan
 * en el payload del POS (listaPrecioIdAplicada + listaPrecioDefaultId).
 */
import { describe, expect, it } from 'vitest';
import { getPrecioEfectivo } from './pricing';

describe('getPrecioEfectivo (adaptador del resolver compartido, LP-1.3)', () => {
	const productoPos = {
		precioVenta: 1000,
		listaPrecioIdAplicada: 'lp-pv',
		listaPrecioDefaultId: 'lp-default',
		precios: [
			{ listaPrecioId: 'lp-pv', precio: 900 },
			{ listaPrecioId: 'lp-cliente', precio: 800 },
			{ listaPrecioId: 'lp-default', precio: 850 },
		],
	};

	it('prioriza la entrada de la lista del cliente', () => {
		expect(getPrecioEfectivo(productoPos, 'lp-cliente')).toBe(800);
	});

	it('cae a la lista del PV cuando el cliente no tiene entrada', () => {
		expect(getPrecioEfectivo(productoPos, 'lp-sin-entrada')).toBe(900);
	});

	it('cae a la lista del PV cuando no hay cliente', () => {
		expect(getPrecioEfectivo(productoPos, null)).toBe(900);
	});

	it('cae a la lista default cuando el PV no tiene lista asignada', () => {
		expect(
			getPrecioEfectivo(
				{ ...productoPos, listaPrecioIdAplicada: null },
				null,
			),
		).toBe(850);
	});

	it('la entrada del PV gana sobre la lista default', () => {
		expect(getPrecioEfectivo(productoPos, null)).toBe(900);
	});

	it('la lista del cliente gana sobre la default cuando el PV no aplica', () => {
		expect(
			getPrecioEfectivo(
				{ ...productoPos, listaPrecioIdAplicada: null },
				'lp-cliente',
			),
		).toBe(800);
	});

	it('cae al precio base cuando ninguna lista tiene entrada', () => {
		expect(
			getPrecioEfectivo(
				{ ...productoPos, listaPrecioIdAplicada: 'lp-vacia', listaPrecioDefaultId: 'lp-vacia' },
				'lp-vacia',
			),
		).toBe(1000);
	});

	it('sin ids de lista ni precios devuelve el precio base', () => {
		expect(getPrecioEfectivo({ precioVenta: 100 })).toBe(100);
	});
});
