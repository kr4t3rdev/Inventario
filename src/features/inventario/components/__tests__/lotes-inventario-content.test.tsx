/**
 * @description Pruebas del listado de lotes del inventario.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LotesInventarioContent, type LoteListadoFila } from '../lotes-inventario-content';

const lotes: LoteListadoFila[] = [
	{
		id: 'lote-1',
		codigo: 'L-2026-001',
		productoNombre: 'Arroz',
		fechaVencimiento: '2026-12-01T00:00:00.000Z',
		cantidadInicial: 10,
		cantidadDisponible: 4,
	},
];

describe('LotesInventarioContent', () => {
	it('muestra los lotes con su enlace a la trazabilidad', () => {
		render(<LotesInventarioContent lotes={lotes} />);

		expect(screen.getByText('L-2026-001')).toBeInTheDocument();
		expect(screen.getByText('Arroz')).toBeInTheDocument();
		expect(screen.getByText('2026-12-01')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Ver trazabilidad' })).toHaveAttribute(
			'href',
			'/busy/inventario/lotes/lote-1',
		);
	});

	it('muestra el estado vacio cuando el tenant no tiene lotes', () => {
		render(<LotesInventarioContent lotes={[]} />);

		expect(screen.getByRole('status')).toHaveTextContent('Todavia no hay lotes registrados');
	});
});
