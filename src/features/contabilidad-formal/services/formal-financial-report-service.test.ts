import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ periodoContable: { findFirst: vi.fn() } }));
const mocks = vi.hoisted(() => ({
	readCoverageEvidence: vi.fn(),
	evaluateCoverageEvidence: vi.fn(),
	verifyReversalIntegrity: vi.fn(),
	readFormalReportData: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('./financial-ledger-coverage-reader', () => ({ readCoverageEvidence: mocks.readCoverageEvidence }));
vi.mock('./financial-ledger-coverage', () => ({ evaluateCoverageEvidence: mocks.evaluateCoverageEvidence }));
vi.mock('./financial-ledger-reversal-integrity', () => ({ verifyReversalIntegrity: mocks.verifyReversalIntegrity }));
vi.mock('./formal-financial-report-data', () => ({ readFormalReportData: mocks.readFormalReportData }));

import { getFormalFinancialReport } from './formal-financial-report-service';

const CORTE = new Date('2026-12-31T23:59:59.000Z');
const INICIO = new Date('2026-01-01T00:00:00.000Z');
const PARAMETROS = { tenantId: 'tenant-a', periodoId: 'periodo-1', cutoffAt: CORTE };
const CUENTA = { id: 'c1', code: '1.1', name: 'Caja', type: 'ACTIVO', nature: 'DEUDORA', balance: '100' };
const RESULTADO = { income: '80', costs: '15', expenses: '5', net: '60' };
const COBERTURA_CUBIERTA = {
	estado: 'CUBIERTA', periodoId: 'periodo-1', replayRunId: 'run-1',
	fuentesEsperadas: 3, fuentesCubiertas: 3, motivos: [],
};

describe('getFormalFinancialReport', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		db.periodoContable.findFirst.mockResolvedValue({ periodoId: 'periodo-1', fechaInicio: INICIO });
		mocks.readCoverageEvidence.mockResolvedValue({ replay: null, asientosEnPeriodo: 2 });
		mocks.evaluateCoverageEvidence.mockReturnValue(COBERTURA_CUBIERTA);
		mocks.verifyReversalIntegrity.mockResolvedValue([]);
		mocks.readFormalReportData.mockResolvedValue({ accounts: [CUENTA], result: RESULTADO });
	});

	it('publica el balance por cuenta y el resultado del periodo', async () => {
		const resolucion = await getFormalFinancialReport(PARAMETROS);

		expect(resolucion).toEqual({
			status: 'AVAILABLE',
			periodoId: 'periodo-1',
			cutoffAt: '2026-12-31T23:59:59.000Z',
			accounts: [CUENTA],
			result: RESULTADO,
			coverage: COBERTURA_CUBIERTA,
		});
	});

	it('lee el mayor desde el inicio del periodo con la cobertura acreditada', async () => {
		await getFormalFinancialReport(PARAMETROS);

		expect(mocks.readFormalReportData).toHaveBeenCalledWith(
			expect.objectContaining({ tenantId: 'tenant-a', from: INICIO, cutoffAt: CORTE }),
		);
	});

	it('no publica el reporte si la cobertura no esta acreditada', async () => {
		mocks.evaluateCoverageEvidence.mockReturnValue({
			estado: 'NO_CUBIERTA', periodoId: 'periodo-1', replayRunId: null,
			fuentesEsperadas: 0, fuentesCubiertas: 0, motivos: ['REPLAY_AUSENTE'],
		});

		const resolucion = await getFormalFinancialReport(PARAMETROS);

		expect(resolucion.status).toBe('UNAVAILABLE');
		expect(resolucion.reason).toBe('COVERAGE_NOT_CREDIFIED');
		expect(mocks.readFormalReportData).not.toHaveBeenCalled();
	});

	it('no publica el reporte si la integridad de reversos falla', async () => {
		mocks.verifyReversalIntegrity.mockResolvedValue([
			{ codigo: 'REVERSO_NO_ENCONTRADO', asientoId: 'original-1', detalle: 'detalle' },
		]);

		const resolucion = await getFormalFinancialReport(PARAMETROS);

		expect(resolucion.status).toBe('UNAVAILABLE');
		expect(resolucion.reason).toBe('REVERSAL_INTEGRITY_FAILED');
		expect(mocks.readFormalReportData).not.toHaveBeenCalled();
	});

	it('no publica el reporte si el periodo no pertenece al tenant', async () => {
		db.periodoContable.findFirst.mockResolvedValue(null);

		const resolucion = await getFormalFinancialReport(PARAMETROS);

		expect(resolucion.status).toBe('UNAVAILABLE');
		expect(resolucion.reason).toBe('PERIODO_NO_ENCONTRADO');
	});

	it('usa el cierre del periodo como corte por defecto', async () => {
		db.periodoContable.findFirst.mockResolvedValue({
			periodoId: 'periodo-1',
			fechaInicio: INICIO,
			fechaFin: new Date('2026-12-31T23:59:59.000Z'),
		});

		const resolucion = await getFormalFinancialReport({
			tenantId: 'tenant-a', periodoId: 'periodo-1',
		});

		expect(resolucion.status).toBe('AVAILABLE');
		if (resolucion.status !== 'AVAILABLE') throw new Error('Se esperaba un reporte disponible');
		expect(resolucion.cutoffAt).toBe('2026-12-31T23:59:59.000Z');
		expect(mocks.readFormalReportData).toHaveBeenCalledWith(
			expect.objectContaining({ cutoffAt: new Date('2026-12-31T23:59:59.000Z') }),
		);
	});

	it.each([
		['tenant', { ...PARAMETROS, tenantId: '' }],
		['periodo', { ...PARAMETROS, periodoId: '' }],
		['corte', { ...PARAMETROS, cutoffAt: new Date('invalido') }],
	])('rechaza el %s invalido antes de consultar', async (_caso, parametros) => {
		await expect(getFormalFinancialReport(parametros)).rejects.toThrow();
		expect(db.periodoContable.findFirst).not.toHaveBeenCalled();
	});
});
