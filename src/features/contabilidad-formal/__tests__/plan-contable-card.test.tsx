/**
 * @description Tests del componente PlanContableCard (CTA-0): gating por
 * feature flag, carga de estado, accion de inicializacion y accesibilidad.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

expect.extend({ toHaveNoViolations });

import { PlanContableCard } from '@/features/contabilidad-formal/components/plan-contable-card';

const estadoMock = vi.hoisted(() => vi.fn());
const inicializarMock = vi.hoisted(() => vi.fn());
const toastExito = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
	user: {
		userId: 'u1',
		role: 'user' as string,
		planFeatures: { 'contabilidad-formal': true } as Record<string, boolean>,
	},
}));

vi.mock('@/contexts/auth-context', () => ({
	useAuth: () => ({ user: authState.user }),
}));

vi.mock('@/features/contabilidad-formal/actions-plan-contable', () => ({
	inicializarPlanContableAction: inicializarMock,
	obtenerEstadoPlanContableAction: estadoMock,
}));

vi.mock('sonner', () => ({
	toast: { success: toastExito, error: toastError },
}));

describe('PlanContableCard', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		authState.user = {
			userId: 'u1',
			role: 'user',
			planFeatures: { 'contabilidad-formal': true },
		};
		estadoMock.mockResolvedValue({
			success: true,
			data: { inicializado: false, cuentas: 0, roles: 0, diarios: 0 },
		});
		inicializarMock.mockResolvedValue({
			success: true,
			data: { diarios: 7, cuentas: 35, roles: 25, plantillas: 30 },
		});
	});

	it('no se renderiza cuando el tenant no tiene el flag', async () => {
		authState.user = { userId: 'u1', role: 'user', planFeatures: {} };
		const { container } = render(<PlanContableCard />);
		await waitFor(() => expect(estadoMock).not.toHaveBeenCalled());
		expect(container.firstChild).toBeNull();
	});

	it('ofrece inicializar cuando el plan no existe y muestra el resumen al confirmar', async () => {
		render(<PlanContableCard />);

		const boton = await screen.findByRole('button', {
			name: 'Inicializar plan de cuentas',
		});
		await userEvent.click(boton);

		await waitFor(() => expect(inicializarMock).toHaveBeenCalledOnce());
		await waitFor(() =>
			expect(toastExito).toHaveBeenCalledWith(
				'Plan de cuentas listo',
				expect.objectContaining({ description: expect.stringContaining('35 cuentas') }),
			),
		);
	});

	it('muestra el resumen cuando el plan ya esta activo', async () => {
		estadoMock.mockResolvedValue({
			success: true,
			data: { inicializado: true, cuentas: 35, roles: 25, diarios: 7 },
		});
		render(<PlanContableCard />);

		expect(await screen.findByText('Activo')).toBeInTheDocument();
		expect(screen.getByText(/35 cuentas/)).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'Inicializar plan de cuentas' }),
		).not.toBeInTheDocument();
	});

	it('avisa con toast de error cuando la accion falla', async () => {
		inicializarMock.mockResolvedValue({
			success: false,
			error: { message: 'El periodo contable esta cerrado para esa fecha' },
		});
		render(<PlanContableCard />);

		const boton = await screen.findByRole('button', {
			name: 'Inicializar plan de cuentas',
		});
		await userEvent.click(boton);

		await waitFor(() =>
			expect(toastError).toHaveBeenCalledWith(
				'El periodo contable esta cerrado para esa fecha',
			),
		);
	});

	it('no tiene violaciones de accesibilidad', async () => {
		const { container } = render(<PlanContableCard />);
		await screen.findByRole('button', { name: 'Inicializar plan de cuentas' });
		expect(await axe(container)).toHaveNoViolations();
	});
});
