/**
 * @description Pruebas de la construcción del documento de origen de trazabilidad del lote.
 */
import { describe, expect, it } from 'vitest';

import {
	construirOrigenTrazabilidad,
	construirTrazabilidadLote,
	type RegistroLoteTrazabilidad,
} from '../trazabilidad-lote';

const compra = {
	cantidad: 10,
	compraDocumento: {
		compraDocumentoId: 'compra-1',
		numeroFactura: 'F-001',
		fechaCompra: new Date('2026-10-01'),
		estado: 'CONFIRMADA',
		proveedor: { nombre: 'Proveedor 1' },
	},
};

const recepcion = {
	cantidad: 10,
	recepcion: {
		id: 'recepcion-1',
		fecha: new Date('2026-10-05'),
		orden: { id: 'oc-1', estado: 'RECIBIDA', proveedor: { nombre: 'Proveedor 2' } },
	},
};

const asignaciones = [
	{
		id: 'alloc-1',
		cantidad: 6,
		costoUnitarioSnapshot: 100,
		ventaItem: {
			id: 'item-1',
			cantidad: 6,
			venta: {
				ventaId: 'venta-1',
				createdAt: new Date('2026-10-20'),
				estado: 'FACTURADA',
				cliente: { nombre: 'Cliente 1' },
				factura: { numeroFactura: 'V-001' },
			},
		},
	},
];

function registro(overrides: Partial<RegistroLoteTrazabilidad>): RegistroLoteTrazabilidad {
	return {
		id: 'lote-1',
		codigo: 'L-2026-001',
		productoId: 'prod-1',
		fechaVencimiento: new Date('2026-12-01'),
		cantidadInicial: 10,
		cantidadDisponible: 4,
		producto: { nombre: 'Arroz' },
		compraItem: compra,
		recepcionItem: null,
		allocations: [],
		...overrides,
	};
}

describe('construirOrigenTrazabilidad', () => {
	it('devuelve la factura de compra como documento de origen', () => {
		expect(construirOrigenTrazabilidad(registro({}))).toEqual({
			tipo: 'COMPRA',
			documentoId: 'compra-1',
			numero: 'F-001',
			fecha: new Date('2026-10-01'),
			estado: 'CONFIRMADA',
			proveedor: 'Proveedor 1',
			cantidad: 10,
		});
	});

	it('usa la recepción cuando el lote no viene de una factura', () => {
		const origen = construirOrigenTrazabilidad(
			registro({ compraItem: null, recepcionItem: recepcion }),
		);

		expect(origen).toMatchObject({
			tipo: 'RECEPCION',
			documentoId: 'recepcion-1',
			numero: 'oc-1',
			proveedor: 'Proveedor 2',
		});
	});

	it('devuelve null cuando el lote no tiene documento de origen', () => {
		const origen = construirOrigenTrazabilidad(
			registro({ compraItem: null, recepcionItem: null }),
		);

		expect(origen).toBeNull();
	});
});

describe('construirTrazabilidadLote', () => {
	it('mapea las ventas destino y suma la cantidad asignada', () => {
		const trazabilidad = construirTrazabilidadLote(registro({ allocations: asignaciones }));

		expect(trazabilidad.lote).toMatchObject({
			id: 'lote-1',
			codigo: 'L-2026-001',
			productoNombre: 'Arroz',
			cantidadInicial: 10,
			cantidadDisponible: 4,
		});
		expect(trazabilidad.cantidadAsignada).toBe(6);
		expect(trazabilidad.destinos).toEqual([{
			ventaId: 'venta-1',
			ventaItemId: 'item-1',
			fecha: new Date('2026-10-20'),
			estado: 'FACTURADA',
			cliente: 'Cliente 1',
			numeroFactura: 'V-001',
			cantidad: 6,
			costoUnitario: 100,
		}]);
	});

	it('devuelve destinos vacíos cuando el lote no fue consumido', () => {
		const trazabilidad = construirTrazabilidadLote(registro({}));

		expect(trazabilidad.destinos).toEqual([]);
		expect(trazabilidad.cantidadAsignada).toBe(0);
	});

	it('usa cliente general y factura nula cuando la venta no los tiene', () => {
		const trazabilidad = construirTrazabilidadLote(registro({
			allocations: [{
				...asignaciones[0],
				ventaItem: {
					...asignaciones[0].ventaItem,
					venta: {
						...asignaciones[0].ventaItem.venta,
						cliente: null,
						factura: null,
					},
				},
			}],
		}));

		expect(trazabilidad.destinos[0]).toMatchObject({
			cliente: 'Cliente general',
			numeroFactura: null,
		});
	});
});
