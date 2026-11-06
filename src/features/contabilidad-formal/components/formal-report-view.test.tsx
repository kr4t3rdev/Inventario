import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { FormalFinancialReportResolution } from '@/features/contabilidad-formal/services/formal-financial-report-contract';
import { FormalReportView } from './formal-report-view';

const DISPONIBLE: FormalFinancialReportResolution = {
	status: 'AVAILABLE',
	periodoId: 'periodo-1',
	cutoffAt: '2026-12-31T23:59:59.000Z',
	accounts: [
		{ id: 'c1', code: '1.1', name: 'Caja', type: 'ACTIVO', nature: 'DEUDORA', balance: '100' },
		{ id: 'c2', code: '2.1', name: 'Proveedores', type: 'PASIVO', nature: 'ACREEDORA', balance: '40' },
		{ id: 'c3', code: '3.1', name: 'Capital', type: 'PATRIMONIO', nature: 'ACREEDORA', balance: '60' },
		{ id: 'c4', code: '4.1', name: 'Ventas', type: 'INGRESO', nature: 'ACREEDORA', balance: '80' },
	],
	result: { income: '80', costs: '0', expenses: '20', net: '60' },
	coverage: {
		estado: 'CUBIERTA',
		periodoId: 'periodo-1',
		replayRunId: 'run-1',
		fuentesEsperadas: 3,
		fuentesCubiertas: 3,
		motivos: [],
	},
};

describe('FormalReportView', () => {
	it('presenta el balance por tipo contable sin mezclar cuentas de resultado', () => {
		render(<FormalReportView resolution={DISPONIBLE} />);

		const activos = screen.getByLabelText('Activos');
		expect(within(activos).getByText('Caja')).toBeDefined();
		expect(within(activos).getByText('100')).toBeDefined();
		expect(screen.getByLabelText('Pasivos')).toBeDefined();
		expect(screen.getByLabelText('Patrimonio')).toBeDefined();
		expect(screen.queryByText('Ventas')).toBeNull();
	});

	it('presenta el resultado del periodo por tipo contable', () => {
		render(<FormalReportView resolution={DISPONIBLE} />);

		const resultado = screen.getByLabelText('Estado de resultados del período');
		expect(within(resultado).getByText('Ingresos')).toBeDefined();
		expect(within(resultado).getByText('80')).toBeDefined();
		expect(within(resultado).getByText('Gastos')).toBeDefined();
		expect(within(resultado).getByText('20')).toBeDefined();
		expect(within(resultado).getByText('Resultado neto')).toBeDefined();
	});

	it('comunica la cobertura acreditada de las fuentes', () => {
		render(<FormalReportView resolution={DISPONIBLE} />);

		expect(screen.getByText(/cobertura acreditada/i)).toBeDefined();
		expect(screen.getByText(/3 de 3 fuentes/i)).toBeDefined();
	});

	it('muestra el estado de indisponibilidad cuando no hay evidencia', () => {
		render(
			<FormalReportView
				resolution={{
					status: 'UNAVAILABLE',
					reason: 'COVERAGE_NOT_CREDIFIED',
					periodoId: 'periodo-1',
					coverage: null,
					problems: [],
				}}
			/>,
		);

		expect(screen.getByText('Este reporte no está disponible')).toBeDefined();
	});
});
