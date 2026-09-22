/**
 * @description Tests de la página de libros contables (CTA-2 T3): gating por
 * feature flag, estructura de pestañas y accesibilidad.
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { beforeEach, describe, expect, it, vi, type ExpectMatcherFn } from 'vitest';

import { LibrosPageClient } from '@/features/contabilidad-formal/components/libros-page-client';

expect.extend({ toHaveNoViolations: toHaveNoViolations as ExpectMatcherFn });

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

vi.mock('@/features/contabilidad/actions-periodos', () => ({
	listarPeriodosAction: vi.fn().mockResolvedValue({ success: true, data: { periodos: [] } }),
}));

vi.mock('@/features/contabilidad-formal/actions-libros', () => ({
	getLibroDiarioAction: vi.fn().mockResolvedValue({ success: true, data: { asientos: [], total: 0, page: 1, paginas: 1, limit: 50, totales: { debe: 0, haber: 0 } } }),
	getLibroMayorAction: vi.fn().mockResolvedValue({ success: true, data: { cuenta: { codigo: '1.1.01', nombre: 'Caja general', tipo: 'ACTIVO', naturaleza: 'DEUDORA' }, saldoInicial: 0, movimientos: [], saldoFinal: 0, moneda: 'CUP', totales: { debe: 0, haber: 0 } } }),
	getBalanceComprobacionAction: vi.fn().mockResolvedValue({ success: true, data: { filas: [], totales: { debe: 0, haber: 0, saldoDeudor: 0, saldoAcreedor: 0 } } }),
	getConciliacionCruzadaAction: vi.fn().mockResolvedValue({ success: true, data: { monedaFuncional: 'CUP', generadoAt: new Date().toISOString(), rubros: [] } }),
	getCuentasMayorablesAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

describe('LibrosPageClient (CTA-2)', () => {
	beforeEach(() => {
		authState.user = {
			userId: 'u1',
			role: 'user',
			planFeatures: { 'contabilidad-formal': true },
		};
	});

	it('renderiza las cuatro pestañas cuando el feature está activo', async () => {
		render(<LibrosPageClient />);
		expect(await screen.findByText('Libros contables')).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'Libro diario' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'Libro mayor' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'Balance de comprobación' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: /Conciliación/ })).toBeInTheDocument();
	});

	it('no renderiza nada cuando el tenant no tiene el flag', () => {
		authState.user = { userId: 'u1', role: 'user', planFeatures: {} };
		const { container } = render(<LibrosPageClient />);
		expect(container.firstChild).toBeNull();
	});

	it('la página no tiene violaciones de accesibilidad', async () => {
		const { container } = render(<LibrosPageClient />);
		await screen.findByText('Libros contables');
		expect(await axe(container)).toHaveNoViolations();
	});
});
