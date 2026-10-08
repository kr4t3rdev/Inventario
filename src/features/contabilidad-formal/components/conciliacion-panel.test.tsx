import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConciliacionPanel } from '@/features/contabilidad-formal/components/conciliacion-panel';
import { getConciliacionCruzadaAction } from '@/features/contabilidad-formal/actions-libros';

vi.mock('@/features/contabilidad-formal/actions-libros', () => ({
	getConciliacionCruzadaAction: vi.fn(),
}));

const getConciliacionMock = vi.mocked(getConciliacionCruzadaAction);


const resultadoNoEvaluable = {
	monedaFuncional: 'CUP',
	generadoAt: '2026-09-26T12:00:00.000Z',
	estado: 'NO_EVALUABLE' as const,
	enforceReady: false,
	rubros: [
		{
			clave: 'TESORERIA' as const,
			nombre: 'Tesorería (caja y bancos)',
			saldoLibros: '100',
			saldoOperativo: '100',
			diferencia: '0',
			estado: 'NO_EVALUABLE' as const,
			nota: 'Falta una fuente comparable para evaluar este rubro.',
		},
	],
};

describe('ConciliacionPanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('identifica como no evaluable el rubro y muestra su causa', async () => {
		getConciliacionMock.mockResolvedValue({ success: true, data: resultadoNoEvaluable });

		render(<ConciliacionPanel />);

		expect(await screen.findByText('No evaluable')).toBeInTheDocument();
		expect(screen.queryByText('Diverge')).not.toBeInTheDocument();
		expect(screen.getByText('Falta una fuente comparable para evaluar este rubro.')).toBeInTheDocument();
		expect(screen.getByText('Estado general: No evaluable')).toBeInTheDocument();
		expect(screen.getByText('Enforce no disponible')).toBeInTheDocument();
	});

	it('no confunde una conciliación conforme con la activación de Enforce', async () => {
		getConciliacionMock.mockResolvedValue({ success: true, data: {
			...resultadoNoEvaluable,
			estado: 'CONFORME',
			enforceReady: true,
			rubros: [{ ...resultadoNoEvaluable.rubros[0], estado: 'OK', nota: undefined }],
		} });
		render(<ConciliacionPanel />);
		expect(await screen.findByText('Apto para revisión de Enforce')).toBeInTheDocument();
		expect(screen.queryByText('Enforce habilitado')).not.toBeInTheDocument();
	});

	it('mantiene el estado de divergencia para diferencias evaluables', async () => {
		getConciliacionMock.mockResolvedValue({
			success: true,
			data: {
				...resultadoNoEvaluable,
				estado: 'DIFERENCIA',
				enforceReady: false,
				rubros: [{ ...resultadoNoEvaluable.rubros[0], estado: 'DIFERENCIA', nota: undefined, diferencia: '5' }],
			},
		});

		render(<ConciliacionPanel />);

		expect(await screen.findByText('Diverge')).toBeInTheDocument();
		expect(screen.getByText('Estado general: Diferencia')).toBeInTheDocument();
	});

	it('muestra Sin cobertura cuando el servicio no puede valorar un corte parcial', async () => {
		getConciliacionMock.mockResolvedValue({
			success: true,
			data: {
				...resultadoNoEvaluable,
				rubros: [{
					...resultadoNoEvaluable.rubros[0],
					saldoLibros: null,
					saldoOperativo: null,
					diferencia: null,
				}],
			},
		});

		render(<ConciliacionPanel />);

		expect(await screen.findByText('No evaluable')).toBeInTheDocument();
		expect(screen.getAllByText('Sin cobertura')).toHaveLength(2);
		expect(screen.queryByText('Diferencia')).not.toBeInTheDocument();
	});

	it('mantiene estado accesible y foco operativo en la actualización', async () => {
		getConciliacionMock.mockResolvedValue({ success: true, data: resultadoNoEvaluable });

		const { container } = render(<ConciliacionPanel />);

		await screen.findByText('No evaluable');
		expect(await axe(container)).toHaveNoViolations();
		expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');

		const actualizar = screen.getByRole('button', { name: 'Actualizar' });
		actualizar.focus();
		expect(actualizar).toHaveFocus();
	});
});
