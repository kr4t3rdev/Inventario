/**
 * @description Tests de la página de libros contables (CTA-2 T3): gating por
 * feature flag, estructura de pestañas y accesibilidad.
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

expect.extend({ toHaveNoViolations });

import { LibrosPageClient } from '@/features/contabilidad-formal/components/libros-page-client';
import { LibroDiarioTable } from '@/features/contabilidad-formal/components/libro-diario-table';
import { getLibroDiarioAction } from '@/features/contabilidad-formal/actions-libros';


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

describe('LibroDiarioTable date-only rendering', () => {
	beforeEach(() => {
		vi.stubEnv('TZ', 'America/New_York');
	});

	it('muestra la fecha civil del asiento sin desplazarla al día anterior', async () => {
		vi.mocked(getLibroDiarioAction).mockResolvedValue({
			success: true,
			data: {
				asientos: [{
					asientoId: 'opening-1',
					etiqueta: 'APE-1',
					numero: 1,
					diarioCodigo: 'APE',
					diarioNombre: 'Apertura',
					fecha: new Date('2026-11-22T00:00:00.000Z'),
					descripcion: 'Asiento de apertura',
					origenTipo: 'inicializacion_contable',
					origenId: 'opening-key',
					estado: 'POSTEADO',
					lineas: [{
						orden: 1,
						cuentaCodigo: '1.1.02',
						cuentaNombre: 'Bancos',
						debe: 100000,
						haber: 0,
						monedaOriginal: 'CUP',
						montoOriginal: 100000,
						referencia: 'Apertura QA',
					}],
					totalDebe: 100000,
					totalHaber: 100000,
				}],
				total: 1,
				page: 1,
				paginas: 1,
				limit: 50,
				totales: { debe: 100000, haber: 100000 },
			},
		} as never);

		render(<LibroDiarioTable periodoId="periodo-1" />);

		expect(await screen.findByText('22/11/2026')).toBeInTheDocument();
	});
});
