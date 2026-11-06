import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
	asiento: { findMany: vi.fn() },
	checkpointContableFormal: { create: vi.fn() },
}));
const reporteMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('./formal-financial-report-service', () => ({ getFormalFinancialReport: reporteMock }));

import { crearCheckpointFormal } from './formal-checkpoint-service';

const REPORTE_DISPONIBLE = {
	status: 'AVAILABLE',
	periodoId: 'periodo-1',
	cutoffAt: '2026-01-31T23:59:59.999Z',
	accounts: [
		{ id: 'c1', code: '1.1', name: 'Caja', type: 'ACTIVO', nature: 'DEUDORA', balance: '100' },
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

describe('crearCheckpointFormal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		reporteMock.mockResolvedValue(REPORTE_DISPONIBLE);
		db.asiento.findMany.mockResolvedValue([
			{ asientoId: 'a-1', hash: 'h1' },
			{ asientoId: 'a-2', hash: 'h2' },
		]);
		db.checkpointContableFormal.create.mockResolvedValue({ checkpointId: 'checkpoint-1' });
	});

	it('persiste el checkpoint con la procedencia del mayor y la cobertura acreditada', async () => {
		const resultado = await crearCheckpointFormal({ tenantId: 'tenant-a', periodoId: 'periodo-1' });

		expect(resultado.checkpointId).toBe('checkpoint-1');
		expect(resultado.replayRunId).toBe('run-1');
		expect(resultado.ledgerHash).toHaveLength(64);
		expect(resultado.hashIntegridad).toHaveLength(64);

		const creado = db.checkpointContableFormal.create.mock.calls[0][0];
		expect(creado.data.tenantId).toBe('tenant-a');
		expect(creado.data.periodoId).toBe('periodo-1');
		expect(creado.data.replayRunId).toBe('run-1');
		expect(creado.data.ledgerHash).toBe(resultado.ledgerHash);
		expect(creado.data.hashIntegridad).toBe(resultado.hashIntegridad);
		expect(creado.data.payload.result).toEqual(REPORTE_DISPONIBLE.result);
	});

	it('acota la procedencia a los asientos del tenant hasta el corte', async () => {
		await crearCheckpointFormal({ tenantId: 'tenant-a', periodoId: 'periodo-1' });

		expect(db.asiento.findMany).toHaveBeenCalledWith(expect.objectContaining({
			where: {
				tenantId: 'tenant-a',
				fecha: { lte: new Date('2026-01-31T23:59:59.999Z') },
			},
		}));
	});

	it('no crea el checkpoint cuando el reporte no esta disponible', async () => {
		reporteMock.mockResolvedValue({
			status: 'UNAVAILABLE',
			reason: 'COVERAGE_NOT_CREDIFIED',
			periodoId: 'periodo-1',
			coverage: null,
			problems: [],
		});

		await expect(crearCheckpointFormal({ tenantId: 'tenant-a', periodoId: 'periodo-1' }))
			.rejects.toThrow(/cobertura acreditada/);
		expect(db.checkpointContableFormal.create).not.toHaveBeenCalled();
	});

	it('rechaza un tenant o periodo vacio antes de consultar', async () => {
		await expect(crearCheckpointFormal({ tenantId: '', periodoId: 'periodo-1' })).rejects.toThrow();
		expect(reporteMock).not.toHaveBeenCalled();
	});
});
