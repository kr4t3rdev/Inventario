import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  asiento: { count: vi.fn(), findMany: vi.fn() },
  replayRun: { findFirst: vi.fn() },
  ordenProduccion: { count: vi.fn(), findMany: vi.fn() },
}));
const snapshotPeriodo = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('./replay-backfill-service', () => ({ snapshotPeriodo }));

import { readCoverageEvidence } from './financial-ledger-coverage-reader';

describe('readCoverageEvidence', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.asiento.count.mockResolvedValue(4);
    db.ordenProduccion.count.mockResolvedValue(0);
    db.asiento.findMany.mockResolvedValue([]);
    db.replayRun.findFirst.mockResolvedValue({
      replayRunId: 'run-1',
      status: 'COMPLETED',
      omittedCount: 0,
      ambiguousCount: 0,
      noFxCount: 0,
      noCostCount: 0,
      outOfPeriodCount: 0,
      diagnostic: {
        reconciliation: {
          scope: 'APPROVED_SOURCE_SNAPSHOT',
          status: 'CONFORME',
          expectedCount: 3,
          matchedCount: 3,
        },
      },
    });
  });

  it('reune la evidencia del replay y el libro del periodo', async () => {
    const evidencia = await readCoverageEvidence({ tenantId: 'tenant-a', periodoId: 'periodo-1' });

    expect(evidencia.asientosEnPeriodo).toBe(4);
    expect(evidencia.replay?.replayRunId).toBe('run-1');
    expect(evidencia.replay?.reconciliacion).toEqual({
      status: 'CONFORME',
      expectedCount: 3,
      matchedCount: 3,
    });
  });

  it('detecta órdenes históricas completadas sin fecha efectiva, sin leer importes', async () => {
    db.ordenProduccion.count.mockResolvedValue(1);

    const evidencia = await readCoverageEvidence({ tenantId: 'tenant-a', periodoId: 'periodo-1' });

    expect(evidencia.fuentesProduccionNoEvaluables).toBe(1);
    expect(db.ordenProduccion.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', estado: 'COMPLETADA', fechaContabilizacion: null },
    });
    expect(db.ordenProduccion.findMany).not.toHaveBeenCalled();
  });

  it('limita el replay al tenant y al periodo solicitados', async () => {
    await readCoverageEvidence({ tenantId: 'tenant-a', periodoId: 'periodo-1' });

    expect(db.replayRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-a', preflight: { periodoId: 'periodo-1' } },
    }));
    expect(db.asiento.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', periodoId: 'periodo-1' },
    });
  });

  it('devuelve evidencia sin replay cuando el periodo no fue reconstruido', async () => {
    db.replayRun.findFirst.mockResolvedValue(null);

    const evidencia = await readCoverageEvidence({ tenantId: 'tenant-a', periodoId: 'periodo-1' });

    expect(evidencia.replay).toBeNull();
    expect(evidencia.asientosEnPeriodo).toBe(4);
  });

  it('devuelve evidencia sin reconciliacion cuando el diagnostico no la contiene', async () => {
    db.replayRun.findFirst.mockResolvedValue({
      replayRunId: 'run-1',
      status: 'COMPLETED',
      omittedCount: 0,
      ambiguousCount: 0,
      noFxCount: 0,
      noCostCount: 0,
      outOfPeriodCount: 0,
      diagnostic: { periodGuardBypass: {} },
    });

    const evidencia = await readCoverageEvidence({ tenantId: 'tenant-a', periodoId: 'periodo-1' });

    expect(evidencia.replay?.reconciliacion).toBeNull();
  });

  it('rechaza tenant o periodo vacios antes de consultar', async () => {
    await expect(readCoverageEvidence({ tenantId: '', periodoId: 'periodo-1' })).rejects.toThrow();
    await expect(readCoverageEvidence({ tenantId: 'tenant-a', periodoId: '' })).rejects.toThrow();
    expect(db.replayRun.findFirst).not.toHaveBeenCalled();
    expect(db.asiento.count).not.toHaveBeenCalled();
  });

  it('reconstruye el snapshot con el contexto compartido de fuentes', async () => {
    db.replayRun.findFirst.mockResolvedValue({
      replayRunId: 'run-1',
      status: 'COMPLETED',
      omittedCount: 0,
      ambiguousCount: 0,
      noFxCount: 0,
      noCostCount: 0,
      outOfPeriodCount: 0,
      diagnostic: {},
      preflight: { snapshot: { sources: [] }, digest: 'digest-1', digestVersion: 2 },
    });
    snapshotPeriodo.mockResolvedValue({ sources: [] });
    const contexto = { obtener: vi.fn(), tenantId: 'tenant-a', client: db };

    await readCoverageEvidence({
      tenantId: 'tenant-a', periodoId: 'periodo-1', contexto: contexto as never,
    });

    // La lectura comparte el contexto con el resto de periodos evaluados: las
    // fuentes del tenant no se recolectan una vez por periodo.
    expect(snapshotPeriodo).toHaveBeenCalledWith(
      db, 'tenant-a', 'periodo-1', contexto,
    );
  });
});
