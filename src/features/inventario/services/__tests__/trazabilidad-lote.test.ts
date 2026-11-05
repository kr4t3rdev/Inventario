/**
 * @description Pruebas de la construcción del documento de origen de trazabilidad del lote.
 */
import { describe, expect, it } from 'vitest';

import {
	construirOrigenTrazabilidad,
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
