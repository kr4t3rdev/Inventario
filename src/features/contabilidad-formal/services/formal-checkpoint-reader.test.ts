import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
	asiento: { findMany: vi.fn() },
	checkpointContableFormal: { findFirst: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: db }));

import { hashCanonical } from './formal-checkpoint-hash';
import { leerCheckpointFormal } from './formal-checkpoint-reader';

const PAYLOAD = {
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

const ASIENTOS = [
	{ asientoId: 'a-1', hash: 'h1' },
	{ asientoId: 'a-2', hash: 'h2' },
];

describe('leerCheckpointFormal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		db.checkpointContableFormal.findFirst.mockResolvedValue({
			checkpointId: 'checkpoint-1',
			periodoId: 'periodo-1',
			cutoffAt: new Date('2026-01-31T23:59:59.999Z'),
			ledgerHash: hashCanonical(ASIENTOS.map((asiento) => [asiento.asientoId, asiento.hash])),
			hashIntegridad: hashCanonical(PAYLOAD),
			payload: PAYLOAD,
		});
		db.asiento.findMany.mockResolvedValue(ASIENTOS);
	});

	it('devuelve el checkpoint verificado cuando el payload y el ledger coinciden', async () => {
		const lectura = await leerCheckpointFormal({ tenantId: 'tenant-a', periodoId: 'periodo-1' });

		expect(lectura.status).toBe('VERIFICADO');
		if (lectura.status !== 'VERIFICADO') throw new Error('Se esperaba un checkpoint verificado');
		expect(lectura.checkpointId).toBe('checkpoint-1');
		expect(lectura.payload.result.net).toBe('60');
	});

	it('rechaza el checkpoint cuando el payload persistido fue alterado', async () => {
		db.checkpointContableFormal.findFirst.mockResolvedValue({
			checkpointId: 'checkpoint-1',
			periodoId: 'periodo-1',
			cutoffAt: new Date('2026-01-31T23:59:59.999Z'),
			ledgerHash: 'a',
			hashIntegridad: hashCanonical(PAYLOAD),
			payload: { ...PAYLOAD, result: { ...PAYLOAD.result, net: '999' } },
		});

		const lectura = await leerCheckpointFormal({ tenantId: 'tenant-a', periodoId: 'periodo-1' });

		expect(lectura).toMatchObject({ status: 'NO_VERIFICADO', motivo: 'PAYLOAD_ALTERADO' });
	});

	it('rechaza el checkpoint cuando el mayor formal cambio', async () => {
		db.asiento.findMany.mockResolvedValue([...ASIENTOS, { asientoId: 'a-3', hash: 'h3' }]);

		const lectura = await leerCheckpointFormal({ tenantId: 'tenant-a', periodoId: 'periodo-1' });

		expect(lectura).toMatchObject({ status: 'NO_VERIFICADO', motivo: 'LEDGER_ALTERADO' });
	});

	it('informa que el periodo no tiene checkpoint formal', async () => {
		db.checkpointContableFormal.findFirst.mockResolvedValue(null);

		const lectura = await leerCheckpointFormal({ tenantId: 'tenant-a', periodoId: 'periodo-1' });

		expect(lectura).toEqual({ status: 'NO_ENCONTRADO' });
	});
});
