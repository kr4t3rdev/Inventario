import { describe, expect, it } from 'vitest';

import { formalReportToCsv } from './formal-report-csv';

const REPORTE = {
	status: 'AVAILABLE' as const,
	periodoId: 'periodo-1',
	cutoffAt: '2026-01-31T23:59:59.999Z',
	accounts: [
		{ id: 'c1', code: '1.1', name: 'Caja', type: 'ACTIVO', nature: 'DEUDORA', balance: '100.0000' },
		{ id: 'c2', code: '2.1', name: 'Proveedores, S.A.', type: 'PASIVO', nature: 'ACREEDORA', balance: '40' },
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

describe('formalReportToCsv', () => {
	it('encabeza las secciones de balance y resultado', () => {
		const csv = formalReportToCsv(REPORTE);
		const filas = csv.trim().split('\n');

		expect(filas[0]).toBe('seccion,tipo,codigo,cuenta,importe');
		expect(filas[1]).toBe('BALANCE,ACTIVO,1.1,Caja,100.0000');
	});

	it('emite el resultado del periodo por tipo contable', () => {
		const csv = formalReportToCsv(REPORTE);

		expect(csv).toContain('RESULTADO,INGRESOS,,,80');
		expect(csv).toContain('RESULTADO,RESULTADO_NETO,,,60');
	});

	it('conserva la precision decimal exacta de los saldos', () => {
		const csv = formalReportToCsv(REPORTE);

		expect(csv).toContain('100.0000');
	});

	it('entrecomilla los campos que contienen separadores', () => {
		const csv = formalReportToCsv(REPORTE);

		expect(csv).toContain('"Proveedores, S.A."');
	});
});
