import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listarMock = vi.hoisted(() => vi.fn());
const reporteMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/contabilidad-formal/actions-reporte', () => ({
	listarPeriodosFormalesAction: listarMock,
	getFormalFinancialReportAction: reporteMock,
}));

import ReporteFormalPage from './page';

const PERIODO = {
	periodoId: 'periodo-1',
	codigo: 'M-2026-01',
	tipo: 'MENSUAL',
	estado: 'APROBADO',
	fechaInicio: '2026-01-01T00:00:00.000Z',
	fechaFin: '2026-01-31T23:59:59.999Z',
	asientos: 8,
};

const REPORTE = {
	status: 'AVAILABLE',
	periodoId: 'periodo-1',
	cutoffAt: '2026-01-31T23:59:59.999Z',
	accounts: [
		{ id: 'c1', code: '1.1', name: 'Caja', type: 'ACTIVO', nature: 'DEUDORA', balance: '100' },
	],
	result: { income: '80', costs: '0', expenses: '20', net: '60' },
	coverage: {
		estado: 'CUBIERTA', periodoId: 'periodo-1', replayRunId: 'run-1',
		fuentesEsperadas: 3, fuentesCubiertas: 3, motivos: [],
	},
};

describe('/busy/contabilidad/reporte-formal page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		listarMock.mockResolvedValue({ success: true, data: [PERIODO] });
		reporteMock.mockResolvedValue({ success: true, data: REPORTE });
	});

	it('consulta el reporte del primer periodo con evidencia formal', async () => {
		render(<ReporteFormalPage />);

		await waitFor(() => {
			expect(reporteMock).toHaveBeenCalledWith({ periodoId: 'periodo-1' });
		});
		expect(await screen.findByText('Caja')).toBeDefined();
		expect(screen.getByText('M-2026-01 · 2026-01-01 → 2026-01-31')).toBeDefined();
	});

	it('informa cuando no hay periodos con evidencia formal', async () => {
		listarMock.mockResolvedValue({ success: true, data: [] });

		render(<ReporteFormalPage />);

		expect(await screen.findByText(/No hay períodos con asientos/i)).toBeDefined();
		expect(reporteMock).not.toHaveBeenCalled();
	});

	it('muestra el error cuando la consulta de periodos falla', async () => {
		listarMock.mockResolvedValue({
			success: false,
			error: { message: 'No se pudieron consultar los períodos' },
		});

		render(<ReporteFormalPage />);

		expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'No se pudieron consultar los períodos');
	});
});
