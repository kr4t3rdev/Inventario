import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
	periodoContable: { findFirst: vi.fn(), findMany: vi.fn() },
	asiento: { findFirst: vi.fn() },
	$transaction: vi.fn(),
	$queryRaw: vi.fn(),
}));
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
		db.$transaction.mockImplementation((callback) => callback(db));
		db.$queryRaw.mockResolvedValue([{ isolation: 'repeatable read' }]);
		db.periodoContable.findFirst.mockResolvedValue({ periodoId: 'periodo-1', fechaInicio: INICIO, fechaFin: CORTE });
		db.periodoContable.findMany.mockResolvedValue([]);
		db.asiento.findFirst.mockResolvedValue(null);
		mocks.readCoverageEvidence.mockResolvedValue({
			replay: null, asientosEnPeriodo: 2, fuentesProduccionNoEvaluables: 0,
		});
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

	it('lee cobertura y datos en una instantanea repeatable read', async () => {
		await getFormalFinancialReport(PARAMETROS);
		expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
			isolationLevel: 'RepeatableRead', maxWait: 10_000, timeout: 120_000,
		});
		expect(mocks.readFormalReportData).toHaveBeenCalledWith(expect.objectContaining({ client: db }));
	});

	it('rechaza un cliente externo sin aislamiento suficiente', async () => {
		db.$queryRaw.mockResolvedValue([{ isolation: 'read committed' }]);
		await expect(getFormalFinancialReport({ ...PARAMETROS, client: db as never }))
			.rejects.toThrow('aislamiento');
		expect(mocks.readFormalReportData).not.toHaveBeenCalled();
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

	it('no lee importes si la evidencia contiene producción histórica no evaluable', async () => {
		mocks.readCoverageEvidence.mockResolvedValue({
			replay: null, asientosEnPeriodo: 2, fuentesProduccionNoEvaluables: 1,
		});
		mocks.evaluateCoverageEvidence.mockImplementation((_periodoId: string, evidencia) => ({
			...COBERTURA_CUBIERTA,
			estado: evidencia.fuentesProduccionNoEvaluables > 0 ? 'NO_CUBIERTA' : 'CUBIERTA',
			motivos: evidencia.fuentesProduccionNoEvaluables > 0 ? ['FUENTES_NO_EVALUADAS'] : [],
		}));

		const resolucion = await getFormalFinancialReport(PARAMETROS);

		expect(resolucion).toMatchObject({ status: 'UNAVAILABLE', reason: 'COVERAGE_NOT_CREDIFIED' });
		expect(mocks.evaluateCoverageEvidence).toHaveBeenCalledWith('periodo-1', expect.objectContaining({
			fuentesProduccionNoEvaluables: 1,
		}));
		expect(mocks.readFormalReportData).not.toHaveBeenCalled();
	});

	it('no publica el balance si un periodo anterior no tiene cobertura', async () => {
		db.periodoContable.findMany.mockResolvedValue([
			{ periodoId: 'periodo-anterior', fechaInicio: new Date('2025-01-01'), fechaFin: new Date('2025-12-31') },
		]);
		mocks.evaluateCoverageEvidence.mockImplementation((periodoId: string) =>
			periodoId === 'periodo-anterior'
				? { ...COBERTURA_CUBIERTA, periodoId, estado: 'NO_CUBIERTA', motivos: ['REPLAY_AUSENTE'] }
				: COBERTURA_CUBIERTA,
		);

		const resolucion = await getFormalFinancialReport(PARAMETROS);

		expect(resolucion.status).toBe('UNAVAILABLE');
		if (resolucion.status !== 'UNAVAILABLE') throw new Error('El reporte debe quedar no disponible');
		expect(resolucion.reason).toBe('COVERAGE_NOT_CREDIFIED');
		expect(mocks.readFormalReportData).not.toHaveBeenCalled();
	});

	it('publica cuando el periodo anterior contiguo tambien tiene cobertura', async () => {
		db.periodoContable.findMany.mockResolvedValue([
			{ periodoId: 'anterior', fechaInicio: new Date('2025-01-01'), fechaFin: new Date('2025-12-31T23:59:59.999Z') },
		]);
		const resolucion = await getFormalFinancialReport(PARAMETROS);
		expect(resolucion.status).toBe('AVAILABLE');
		expect(mocks.readCoverageEvidence).toHaveBeenCalledWith(expect.objectContaining({ periodoId: 'anterior' }));
	});

	it.each([
		['hueco', new Date('2025-12-30T23:59:59.999Z')],
		['solapamiento', new Date('2026-01-01T00:00:00.000Z')],
	])('bloquea el reporte ante %s entre periodos', async (_caso, fechaFin) => {
		db.periodoContable.findMany.mockResolvedValue([
			{ periodoId: 'anterior', fechaInicio: new Date('2025-01-01'), fechaFin },
		]);
		const resolucion = await getFormalFinancialReport(PARAMETROS);
		expect(resolucion).toMatchObject({ status: 'UNAVAILABLE', reason: 'COVERAGE_NOT_CREDIFIED',
			coverage: { motivos: expect.arrayContaining(['PERIODOS_NO_CONTIGUOS']) } });
		expect(mocks.readFormalReportData).not.toHaveBeenCalled();
	});

	it('bloquea si otro período comienza dentro del período reportado y se solapa', async () => {
		db.periodoContable.findMany.mockResolvedValue([{
			periodoId: 'periodo-solapado',
			fechaInicio: new Date('2026-06-01T00:00:00.000Z'),
			fechaFin: new Date('2026-08-31T23:59:59.999Z'),
		}]);

		const resolucion = await getFormalFinancialReport(PARAMETROS);

		expect(db.periodoContable.findMany).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.objectContaining({ fechaInicio: { lte: CORTE } }),
		}));
		expect(resolucion).toMatchObject({ status: 'UNAVAILABLE', reason: 'COVERAGE_NOT_CREDIFIED',
			coverage: { motivos: expect.arrayContaining(['PERIODOS_NO_CONTIGUOS']) } });
		expect(mocks.readFormalReportData).not.toHaveBeenCalled();
	});

	it('bloquea cortes fuera del periodo seleccionado', async () => {
		const resolucion = await getFormalFinancialReport({ ...PARAMETROS, cutoffAt: new Date('2027-01-01') });
		expect(resolucion).toMatchObject({ status: 'UNAVAILABLE', coverage: {
			motivos: expect.arrayContaining(['CORTE_FUERA_DE_PERIODO']),
		} });
		expect(mocks.readFormalReportData).not.toHaveBeenCalled();
	});

	it('bloquea si hay asientos con fechas o periodos inconsistentes', async () => {
		db.asiento.findFirst.mockResolvedValue({ asientoId: 'inconsistente' });
		const resolucion = await getFormalFinancialReport(PARAMETROS);
		expect(resolucion).toMatchObject({ status: 'UNAVAILABLE', coverage: {
			motivos: expect.arrayContaining(['ASIENTOS_FUERA_DE_PERIODO']),
		} });
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
