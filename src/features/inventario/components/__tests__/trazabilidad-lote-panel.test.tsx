/**
 * @description Pruebas del panel de trazabilidad de lote.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/inventario/actions-trazabilidad', () => ({
	getTrazabilidadLoteAction: vi.fn(),
}));

import { getTrazabilidadLoteAction } from '@/features/inventario/actions-trazabilidad';
import { TrazabilidadLotePanel } from '../trazabilidad-lote-panel';

const trazabilidad = {
	lote: {
		id: 'lote-1', codigo: 'L-2026-001', productoId: 'prod-1', productoNombre: 'Arroz',
		fechaVencimiento: new Date('2026-12-01'), cantidadInicial: 10, cantidadDisponible: 4,
	},
	origen: {
		tipo: 'COMPRA', documentoId: 'compra-1', numero: 'F-001', fecha: new Date('2026-10-01'),
		estado: 'CONFIRMADA', proveedor: 'Proveedor 1', cantidad: 10,
	},
	destinos: [{
		ventaId: 'venta-1', ventaItemId: 'item-1', fecha: new Date('2026-10-20'), estado: 'FACTURADA',
		cliente: 'Cliente 1', numeroFactura: 'V-001', cantidad: 6, costoUnitario: 100,
	}],
	cantidadAsignada: 6,
};

describe('TrazabilidadLotePanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('muestra el origen y las ventas destino del lote', async () => {
		vi.mocked(getTrazabilidadLoteAction).mockResolvedValue({
			success: true,
			data: trazabilidad,
		} as never);

		render(<TrazabilidadLotePanel loteId="lote-1" />);

		expect(await screen.findByText(/Lote L-2026-001/)).toBeInTheDocument();
		expect(screen.getByText(/Compra F-001/)).toBeInTheDocument();
		expect(screen.getByText(/V-001/)).toBeInTheDocument();
	});

	it('indica cuando el lote todavia no tiene ventas asociadas', async () => {
		vi.mocked(getTrazabilidadLoteAction).mockResolvedValue({
			success: true,
			data: { ...trazabilidad, destinos: [], cantidadAsignada: 0 },
		} as never);

		render(<TrazabilidadLotePanel loteId="lote-1" />);

		expect(await screen.findByText(/todavia no tiene ventas asociadas/)).toBeInTheDocument();
	});

	it('muestra el error devuelto por la consulta', async () => {
		vi.mocked(getTrazabilidadLoteAction).mockResolvedValue({
			success: false,
			error: { message: 'Lote no encontrado', code: 'NOT_FOUND' },
		} as never);

		render(<TrazabilidadLotePanel loteId="lote-9" />);

		expect(await screen.findByRole('alert')).toHaveTextContent('Lote no encontrado');
	});
});
