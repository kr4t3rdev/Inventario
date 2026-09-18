/**
 * @description Tests de UI del ciclo de pedidos en la tabla de ventas (PVE-T4):
 * badge de estado, filtro por estado y acciones de transición según estado y flag.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/features/productos/hooks/use-productos', () => ({
	useProductos: () => ({ productos: [], isLoading: false, error: undefined }),
}));
vi.mock('@/features/ventas/actions', () => ({
	entregarVentaAction: vi.fn().mockResolvedValue({ success: true, data: {} }),
	facturarVentaAction: vi.fn().mockResolvedValue({ success: true, data: {} }),
	anularVentaAction: vi.fn().mockResolvedValue({ success: true, data: {} }),
	createVentaAction: vi.fn().mockResolvedValue({ success: true, data: {} }),
}));
vi.mock('next/navigation', () => ({
	useRouter: () => ({ refresh: vi.fn() }),
}));

import { VentasTable } from '../components/ventas-table';
import { EstadoVentaBadge } from '../components/estado-venta-badge';
import type { Venta } from '@/app/models/model';

const baseVenta: Venta = {
	ventaId: 'v-1',
	cantidad: 2,
	puntoDeVentaId: 'pv-1',
	createdAt: '2026-08-01T10:00:00.000Z',
	updatedAt: '2026-08-01T10:00:00.000Z',
	total: 100,
	items: [],
};

describe('EstadoVentaBadge', () => {
	it.each([
		['PEDIDO', 'Pedido'],
		['ENTREGADA', 'Entregada'],
		['FACTURADA', 'Facturada'],
		['ANULADA', 'Anulada'],
	] as const)('muestra %s como "%s"', (estado, etiqueta) => {
		render(<EstadoVentaBadge estado={estado} />);
		expect(screen.getByText(etiqueta)).toBeInTheDocument();
	});
});

describe('VentasTable — ciclo de pedidos', () => {
	beforeEach(() => vi.clearAllMocks());

	it('muestra el badge de estado en cada fila', () => {
		render(
			<VentasTable
				ventas={[{ ...baseVenta, estado: 'PEDIDO' }]}
				isLoading={false}
				error={undefined}
				onDelete={vi.fn()}
			/>,
		);
		expect(screen.getByText('Pedido')).toBeInTheDocument();
	});

	it('ofrece Entregar a un PEDIDO y Facturar a una ENTREGADA', () => {
		render(
			<VentasTable
				ventas={[
					{ ...baseVenta, ventaId: 'v-p', estado: 'PEDIDO' },
					{ ...baseVenta, ventaId: 'v-e', estado: 'ENTREGADA' },
				]}
				isLoading={false}
				error={undefined}
				onDelete={vi.fn()}
				pedidosEnabled
			/>,
		);
		expect(screen.getByRole('button', { name: 'Entregar pedido v-p' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Facturar venta v-e' })).toBeInTheDocument();
	});

	it('sin el flag pedidosEnabled no muestra acciones de ciclo', () => {
		render(
			<VentasTable
				ventas={[{ ...baseVenta, ventaId: 'v-p', estado: 'PEDIDO' }]}
				isLoading={false}
				error={undefined}
				onDelete={vi.fn()}
			/>,
		);
		expect(screen.queryByRole('button', { name: 'Entregar pedido v-p' })).not.toBeInTheDocument();
	});

	it('muestra la acción Devolver en ventas entregadas/facturadas', () => {
		render(
			<VentasTable
				ventas={[
					{ ...baseVenta, ventaId: 'v-f', estado: 'FACTURADA' },
					{ ...baseVenta, ventaId: 'v-p', estado: 'PEDIDO' },
				]}
				isLoading={false}
				error={undefined}
				onDelete={vi.fn()}
			/>,
		);
		expect(screen.getByRole('button', { name: 'Devolver venta v-f' })).toBeInTheDocument();
		// Un pedido sin entregar no se puede devolver
		expect(screen.queryByRole('button', { name: 'Devolver venta v-p' })).not.toBeInTheDocument();
	});

	it('filtra por estado al elegirlo en el selector', async () => {
		render(
			<VentasTable
				ventas={[
					{ ...baseVenta, ventaId: 'v-p', estado: 'PEDIDO' },
					{ ...baseVenta, ventaId: 'v-f', estado: 'FACTURADA' },
				]}
				isLoading={false}
				error={undefined}
				onDelete={vi.fn()}
				pedidosEnabled
			/>,
		);
		const select = screen.getByRole('combobox', { name: /filtrar por estado/i });
		(select as HTMLSelectElement).value = 'PEDIDO';
		select.dispatchEvent(new Event('change', { bubbles: true }));
		await waitFor(() => {
			expect(screen.getByText('Pedido')).toBeInTheDocument();
			expect(screen.queryByText('Facturada')).not.toBeInTheDocument();
		});
	});
});
