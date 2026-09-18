/**
 * @description Tests del diálogo de cobro del POS (VC-T3): método de pago,
 * recibido solo cuando aplica, vuelto en vivo y bloqueo de cobro insuficiente.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PosCobroDialog } from '@/features/ventas/components/pos-cobro-dialog';

const base = {
	open: true,
	onOpenChange: vi.fn(),
	total: 4800,
	isProcessing: false,
};

describe('PosCobroDialog (VC-T3)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('con efectivo muestra recibido y calcula el vuelto en vivo', () => {
		const onConfirm = vi.fn();
		render(<PosCobroDialog {...base} onConfirm={onConfirm} />);
		// efectivo es el método por defecto
		const recibido = screen.getByLabelText(/monto recibido/i);
		fireEvent.change(recibido, { target: { value: '5000' } });
		expect(screen.getByText(/vuelto/i)).toHaveTextContent('200');
		const btn = screen.getByRole('button', { name: /cobrar/i });
		expect(btn).not.toBeDisabled();
		fireEvent.click(btn);
		expect(onConfirm).toHaveBeenCalledWith(
			expect.objectContaining({
				metodoPago: 'EFECTIVO',
				montoEfectivo: 4800,
				montoRecibidoEfectivo: 5000,
			}),
		);
	});

	it('bloquea el cobro si el recibido no alcanza', () => {
		render(<PosCobroDialog {...base} onConfirm={vi.fn()} />);
		const recibido = screen.getByLabelText(/monto recibido/i);
		fireEvent.change(recibido, { target: { value: '4000' } });
		const btn = screen.getByRole('button', { name: /cobrar/i });
		expect(btn).toBeDisabled();
		expect(screen.getByText(/insuficiente/i)).toBeInTheDocument();
	});

	it('bloquea el cobro sin recibido capturado', () => {
		render(<PosCobroDialog {...base} onConfirm={vi.fn()} />);
		const btn = screen.getByRole('button', { name: /cobrar/i });
		expect(btn).toBeDisabled();
	});

	it('sin input de recibido para tarjeta', () => {
		render(<PosCobroDialog {...base} onConfirm={vi.fn()} />);
		const metodo = screen.getByLabelText(/método de pago/i);
		fireEvent.change(metodo, { target: { value: 'TARJETA' } });
		expect(screen.queryByLabelText(/monto recibido/i)).not.toBeInTheDocument();
		const btn = screen.getByRole('button', { name: /cobrar/i });
		expect(btn).not.toBeDisabled();
	});

	it('MIXTO completo: suma correcta y recibido suficiente → confirma con desglose', () => {
		const onConfirm = vi.fn();
		render(<PosCobroDialog {...base} onConfirm={onConfirm} />);
		fireEvent.change(screen.getByLabelText(/método de pago/i), { target: { value: 'MIXTO' } });
		fireEvent.change(screen.getByLabelText(/monto efectivo/i), { target: { value: '2000' } });
		fireEvent.change(screen.getByLabelText(/monto tarjeta/i), { target: { value: '2800' } });
		fireEvent.change(screen.getByLabelText(/monto transferencia/i), { target: { value: '0' } });
		fireEvent.change(screen.getByLabelText(/monto recibido/i), { target: { value: '2500' } });
		const btn = screen.getByRole('button', { name: /cobrar/i });
		expect(btn).not.toBeDisabled();
		fireEvent.click(btn);
		expect(onConfirm).toHaveBeenCalledWith(
			expect.objectContaining({
				metodoPago: 'MIXTO',
				montoEfectivo: 2000,
				montoTarjeta: 2800,
				montoRecibidoEfectivo: 2500,
			}),
		);
	});

	it('MIXTO valida que el desglose sume el total', () => {
		render(<PosCobroDialog {...base} onConfirm={vi.fn()} />);
		fireEvent.change(screen.getByLabelText(/método de pago/i), { target: { value: 'MIXTO' } });
		fireEvent.change(screen.getByLabelText(/monto efectivo/i), { target: { value: '2000' } });
		fireEvent.change(screen.getByLabelText(/monto tarjeta/i), { target: { value: '2000' } });
		const btn = screen.getByRole('button', { name: /cobrar/i });
		expect(btn).toBeDisabled();
		expect(screen.getByText(/la suma de los montos debe ser igual/i)).toBeInTheDocument();
	});
});
