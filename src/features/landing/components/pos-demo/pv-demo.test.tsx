import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/turnos-pos/components/cabecera-turno', () => ({
	CabeceraTurno: () => null,
}));

vi.mock('@/features/turnos-pos/components/cierre-turno-dialog', () => ({
	CierreTurnoDialog: () => null,
}));

vi.mock('@/features/landing/components/pos-demo/turnos/demo-apertura-turno-dialog', () => ({
	DemoAperturaTurnoDialog: () => null,
}));

vi.mock('@/features/landing/components/pos-demo/turnos/demo-arqueo-form', () => ({
	DemoArqueoForm: () => null,
}));

vi.mock('@/features/landing/components/pos-demo/turnos/demo-cuadre-turno-dialog', () => ({
	DemoCuadreTurnoDialog: () => null,
}));

import { allocateDemoLineTotals, PvDemoInteractive } from './pv-demo';

describe('PvDemoInteractive', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		HTMLElement.prototype.scrollIntoView = vi.fn();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('distribuye descuentos entre líneas sin alterar el total del ticket', () => {
		const totals = allocateDemoLineTotals(
			[
				{ cantidad: 1, precioVenta: 10 },
				{ cantidad: 2, precioVenta: 10 },
			],
			24.99,
		);

		expect(totals).toEqual([8.33, 16.66]);
		expect(totals.reduce((sum, value) => sum + value, 0)).toBeCloseTo(24.99, 2);
	});

	it('expone el modo de vista seleccionado con aria-pressed', async () => {
		const user = userEvent.setup();
		render(<PvDemoInteractive />);

		const gridButton = screen.getByRole('button', { name: 'Vista de cuadrícula' });
		const listButton = screen.getByRole('button', { name: 'Vista de lista' });

		expect(gridButton).toHaveAttribute('aria-pressed', 'true');
		expect(listButton).toHaveAttribute('aria-pressed', 'false');

		await user.click(listButton);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Vista de lista' })).toHaveAttribute(
				'aria-pressed',
				'true',
			);
			expect(screen.getByRole('button', { name: 'Vista de cuadrícula' })).toHaveAttribute(
				'aria-pressed',
				'false',
			);
		});
	});

	it('permite añadir un producto desde la vista lista con el control Plus', async () => {
		const user = userEvent.setup();
		render(<PvDemoInteractive />);

		await user.click(screen.getByRole('button', { name: 'Vista de lista' }));
		const addButton = screen.getAllByRole('button', {
			name: /añadir .* al carrito/i,
		})[0];

		await user.click(addButton);

		expect(screen.getByText(/1 producto/)).toBeInTheDocument();
	});

	it('mantiene targets táctiles amplios y evita escalar inputs en foco', () => {
		render(<PvDemoInteractive />);

		for (const label of ['Vista de cuadrícula', 'Vista de lista', 'Vista de tabla']) {
			expect(screen.getByRole('button', { name: label })).toHaveClass('size-11');
		}

		for (const input of document.querySelectorAll('input, textarea, [role="combobox"]')) {
			expect(input.className).not.toContain('focus:scale-');
		}
	});

	it('abre checkout como dialog con radios de pago y lo cierra con Escape restaurando foco', async () => {
		const user = userEvent.setup();
		render(<PvDemoInteractive />);

		await user.click(screen.getAllByRole('button', { name: /Añadir .* al carrito/ })[0]);
		const checkoutButton = screen.getByRole('button', { name: 'Cobrar venta' });
		await user.click(checkoutButton);

		const dialog = screen.getByRole('dialog', { name: /cerrar venta/i });
		expect(dialog).toHaveAttribute('aria-modal', 'true');
		expect(screen.getByRole('radiogroup', { name: /forma de pago/i })).toBeInTheDocument();
		expect(screen.getByRole('radio', { name: 'Efectivo' })).toHaveAttribute(
			'aria-checked',
			'true',
		);

		await user.keyboard('{Escape}');

		expect(screen.queryByRole('dialog', { name: /cerrar venta/i })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Cobrar venta' })).toHaveFocus();
	}, 15000);

	it('expone el ticket post-venta como dialog accesible', async () => {
		const user = userEvent.setup();
		render(<PvDemoInteractive />);

		await user.click(screen.getAllByRole('button', { name: /Añadir .* al carrito/ })[0]);
		await user.click(screen.getByRole('button', { name: 'Cobrar venta' }));
		await user.click(screen.getByRole('radio', { name: 'Tarjeta' }));
		await user.click(screen.getByRole('button', { name: 'Confirmar venta' }));
		await waitFor(() => expect(screen.getByRole('dialog', { name: /venta registrada/i })).toBeInTheDocument(), {
			timeout: 2000,
		});

		const ticketDialog = screen.getByRole('dialog', { name: /venta registrada/i });
		expect(ticketDialog).toHaveAttribute('aria-modal', 'true');

		await user.keyboard('{Escape}');
		expect(screen.queryByRole('dialog', { name: /venta registrada/i })).not.toBeInTheDocument();
	}, 15000);

	it('acepta reduceMotion desde el contrato del componente', () => {
		render(<PvDemoInteractive reduceMotion />);

		expect(document.querySelector('[data-pos-demo]')).toHaveAttribute(
			'data-reduce-motion',
			'true',
		);
	});

	it('ofrece un acceso acotado al carrito en mobile cuando hay productos', async () => {
		const user = userEvent.setup();
		render(<PvDemoInteractive />);

		await user.click(screen.getAllByRole('button', { name: /Añadir .* al carrito/ })[0]);
		const mobileCartButton = screen.getByRole('button', { name: /ver carrito/i });

		expect(mobileCartButton).toHaveAttribute('aria-controls', 'demo-pos-cart');
		await user.click(mobileCartButton);

		expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
	}, 15000);
});
