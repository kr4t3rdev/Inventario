/**
 * @description Test de la regla de clasificacion del snapshot canonico (CT-1).
 *
 * El digest que aprueba el preflight y el que verifica la cobertura se
 * calculan con la MISMA regla: si el preflight dice `YA_POSTEADO` y la lectura
 * dice `OMITIDO`, el digest nunca coincide y la cobertura formal queda
 * permanentemente no acreditada.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
	periodoContable: { findFirst: vi.fn() },
	asiento: { findMany: vi.fn() },
}));
const recolectarCandidatos = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('../replay-source-collector', () => ({ recolectarCandidatos }));
vi.mock('../replay-source-manifest', () => ({
	buildReplayManifestEvidence: vi.fn().mockReturnValue({
		complete: true,
		version: 'test-manifiesto',
		fingerprint: 'huella-test',
		requiredEventTypes: [],
		evaluatedEventTypes: [],
		requiredQueryIds: [],
		evaluatedQueryIds: [],
		unclassifiedCount: 0,
	}),
}));

import { snapshotPeriodo } from '../replay-backfill-service';

const FECHA = new Date('2026-01-15T00:00:00.000Z');
const CANDIDATO = {
	origenTipo: 'venta_costo',
	origenId: 'venta-1',
	fecha: FECHA,
	causaOmision: 'ASIGNACION_FIFO_NO_VERIFICABLE',
	evento: {
		tipo: 'COSTO_VENTA_DEVENGADO',
		fecha: FECHA,
		descripcion: 'Costo FIFO histórico de venta venta-1',
		monto: 100,
		moneda: 'CUP',
		montoFuncional: 100,
		monedaFuncional: 'CUP',
		tasaCambio: null,
		fxEvidenceFingerprint: null,
	},
};

describe('snapshotPeriodo', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		db.periodoContable.findFirst.mockResolvedValue({
			periodoId: 'periodo-1',
			fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
			fechaFin: new Date('2026-01-31T23:59:59.000Z'),
		});
		db.asiento.findMany.mockResolvedValue([]);
		recolectarCandidatos.mockResolvedValue([CANDIDATO]);
	});

	it('omite la fuente con causa que todavia no esta contabilizada', async () => {
		const snapshot = await snapshotPeriodo(db as never, 'tenant-a', 'periodo-1');

		expect(snapshot.sources).toHaveLength(1);
		expect(snapshot.sources[0]?.classification).toBe('OMITIDO');
		expect(snapshot.sources[0]?.omissionCause).toBe('ASIGNACION_FIFO_NO_VERIFICABLE');
	});

	it('mantiene acreditada por el asiento la fuente con causa ya contabilizada', async () => {
		db.asiento.findMany.mockResolvedValue([{ origenTipo: 'venta_costo', origenId: 'venta-1' }]);

		const snapshot = await snapshotPeriodo(db as never, 'tenant-a', 'periodo-1');

		expect(snapshot.sources[0]?.classification).toBe('YA_POSTEADO');
		expect(snapshot.sources[0]?.omissionCause).toBeNull();
	});

	it('reconstruye el snapshot con el contexto compartido sin volver a recolectar', async () => {
		const contexto = {
			obtener: vi.fn().mockResolvedValue({
				candidatos: [CANDIDATO],
				posteados: new Set<string>(),
				executedQueryIds: new Set<string>(),
			}),
			tenantId: 'tenant-a',
			client: db,
		};

		const snapshot = await snapshotPeriodo(
			db as never, 'tenant-a', 'periodo-1', contexto as never,
		);

		expect(contexto.obtener).toHaveBeenCalledTimes(1);
		expect(recolectarCandidatos).not.toHaveBeenCalled();
		expect(snapshot.sources[0]?.classification).toBe('OMITIDO');
	});

	it('rechaza un contexto de snapshot de otro tenant', async () => {
		const contexto = {
			obtener: vi.fn(),
			tenantId: 'tenant-b',
			client: db,
		};

		await expect(snapshotPeriodo(
			db as never, 'tenant-a', 'periodo-1', contexto as never,
		)).rejects.toThrow('otro tenant');
		expect(contexto.obtener).not.toHaveBeenCalled();
	});
});
