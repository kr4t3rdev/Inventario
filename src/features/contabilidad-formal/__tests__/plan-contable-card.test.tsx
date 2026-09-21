/**
 * @description Tests del componente PlanContableCard (CTA-0 T4): gating por
 * feature flag, carga de estado, acción de inicialización y accesibilidad.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { beforeEach, describe, expect, it, vi, type ExpectMatcherFn } from 'vitest';

import { PlanContableCard } from '@/features/contabilidad-formal/components/plan-contable-card';

expect.extend({ toHaveNoViolations: toHaveNoViolations as ExpectMatcherFn });

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

vi.mock('@/features/contabilidad-formal/actions', () => ({
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
			data: { diarios: 7, cuentas: 33, roles: 23, plantillas: 82 },
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
				expect.objectContaining({ description: expect.stringContaining('33 cuentas') }),
			),
		);
	});

	it('muestra el resumen cuando el plan ya está activo', async () => {
		estadoMock.mockResolvedValue({
			success: true,
			data: { inicializado: true, cuentas: 33, roles: 23, diarios: 7 },
		});
		render(<PlanContableCard />);

		expect(await screen.findByText('Activo')).toBeInTheDocument();
		expect(screen.getByText(/33 cuentas/)).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'Inicializar plan de cuentas' }),
		).not.toBeInTheDocument();
	});

	it('avisa con toast de error cuando la acción falla', async () => {
		inicializarMock.mockResolvedValue({
			success: false,
			error: { message: 'El período contable está cerrado para esa fecha' },
		});
		render(<PlanContableCard />);

		const boton = await screen.findByRole('button', {
			name: 'Inicializar plan de cuentas',
		});
		await userEvent.click(boton);

		await waitFor(() =>
			expect(toastError).toHaveBeenCalledWith(
				'El período contable está cerrado para esa fecha',
			),
		);
	});

	it('no tiene violaciones de accesibilidad', async () => {
		const { container } = render(<PlanContableCard />);
		await screen.findByRole('button', { name: 'Inicializar plan de cuentas' });
		expect(await axe(container)).toHaveNoViolations();
	});
});
