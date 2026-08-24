import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  financialAuxiliaryCheckpoint: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const balance = { functionalCurrency: 'CUP', assets: { total: 100 } };
const result = { functionalCurrency: 'CUP', annual: { reconciledResult: 20 } };

describe('financial auxiliary checkpoint service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$queryRaw.mockReset();
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ cutoffAt: new Date('2026-08-23T15:00:00.000Z') }])
      .mockResolvedValueOnce([{ capturedAt: new Date('2026-08-23T15:00:01.000Z') }]);
    prismaMock.financialAuxiliaryCheckpoint.create.mockImplementation(async ({ data }) => ({
      checkpointId: 'checkpoint-1',
      ...data,
    }));
  });

  it('captures tenant evidence at database transaction time under the shared lock', async () => {
    const { captureFinancialAuxiliaryCheckpoint } = await import(
      './financial-auxiliary-checkpoint-service'
    );
    const collectEvidence = vi.fn().mockResolvedValue({
      functionalCurrency: 'CUP',
      balance,
      result,
      resultThrough: '2026-08-23T15:00:00.000Z',
      sourceFingerprints: { banks: 'bank-hash' },
      appliedFxEvidence: [],
    });

    const checkpoint = await captureFinancialAuxiliaryCheckpoint({
      tenantId: 'tenant-a',
      capturedBy: 'user-a',
      collectEvidence,
    });

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
    expect(collectEvidence).toHaveBeenCalledWith(
      prismaMock,
      new Date('2026-08-23T15:00:00.000Z'),
    );
    expect(checkpoint).toMatchObject({
      checkpointId: 'checkpoint-1',
      tenantId: 'tenant-a',
      cutoffAt: new Date('2026-08-23T15:00:00.000Z'),
    });
  });

  it('never backdates a missed requested boundary', async () => {
    const { captureFinancialAuxiliaryCheckpoint } = await import(
      './financial-auxiliary-checkpoint-service'
    );
    const collectEvidence = vi.fn();

    await expect(captureFinancialAuxiliaryCheckpoint({
      tenantId: 'tenant-a',
      capturedBy: 'user-a',
      requestedCutoffAt: new Date('2026-08-23T14:59:00.000Z'),
      collectEvidence,
    })).rejects.toMatchObject({ code: 'CUTOFF_EVIDENCE_UNAVAILABLE' });
    expect(collectEvidence).not.toHaveBeenCalled();
    expect(prismaMock.financialAuxiliaryCheckpoint.create).not.toHaveBeenCalled();
  });

  it('returns the existing exact checkpoint on a retry without collecting or creating again', async () => {
    const { captureFinancialAuxiliaryCheckpoint } = await import(
      './financial-auxiliary-checkpoint-service'
    );
    const existing = {
      checkpointId: 'checkpoint-existing',
      tenantId: 'tenant-a',
      cutoffAt: new Date('2026-08-23T15:00:00.000Z'),
      capturedAt: new Date('2026-08-23T15:00:01.000Z'),
    };
    prismaMock.financialAuxiliaryCheckpoint.findUnique.mockResolvedValue(existing);
    const collectEvidence = vi.fn();

    const checkpoint = await captureFinancialAuxiliaryCheckpoint({
      tenantId: 'tenant-a',
      capturedBy: 'user-a',
      collectEvidence,
    });

    expect(checkpoint).toBe(existing);
    expect(collectEvidence).not.toHaveBeenCalled();
    expect(prismaMock.financialAuxiliaryCheckpoint.create).not.toHaveBeenCalled();
  });

  it('resolves a previously captured requested cutoff before evaluating a new boundary', async () => {
    const { captureFinancialAuxiliaryCheckpoint } = await import(
      './financial-auxiliary-checkpoint-service',
    );
    const requestedCutoffAt = new Date('2026-08-23T15:00:00.000Z');
    const existing = {
      checkpointId: 'checkpoint-existing',
      tenantId: 'tenant-a',
      cutoffAt: requestedCutoffAt,
      capturedAt: new Date('2026-08-23T15:00:01.000Z'),
    };
    prismaMock.$queryRaw.mockReset().mockResolvedValueOnce([
      { cutoffAt: new Date('2026-08-23T15:01:00.000Z') },
    ]);
    prismaMock.financialAuxiliaryCheckpoint.findUnique
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(null);
    const collectEvidence = vi.fn();

    const checkpoint = await captureFinancialAuxiliaryCheckpoint({
      tenantId: 'tenant-a',
      capturedBy: 'user-a',
      requestedCutoffAt,
      collectEvidence,
    });

    expect(checkpoint).toBe(existing);
    expect(collectEvidence).not.toHaveBeenCalled();
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it('reads only an exact tenant-owned cutoff and rejects a modified payload', async () => {
    const {
      captureFinancialAuxiliaryCheckpoint,
      findFinancialAuxiliaryCheckpoint,
    } = await import('./financial-auxiliary-checkpoint-service');
    const created = await captureFinancialAuxiliaryCheckpoint({
      tenantId: 'tenant-a',
      capturedBy: 'user-a',
      collectEvidence: vi.fn().mockResolvedValue({
        functionalCurrency: 'CUP',
        balance,
        result,
        resultThrough: '2026-08-23T15:00:00.000Z',
        sourceFingerprints: {},
        appliedFxEvidence: [],
      }),
    });
    prismaMock.financialAuxiliaryCheckpoint.findUnique.mockResolvedValue({
      ...created,
      payload: { ...(created as { payload: object }).payload, balance: { assets: { total: 999 } } },
    });

    await expect(findFinancialAuxiliaryCheckpoint({
      tenantId: 'tenant-a',
      cutoffAt: new Date('2026-08-23T15:00:00.000Z'),
    })).rejects.toMatchObject({ code: 'CHECKPOINT_INTEGRITY_FAILED' });
    expect(prismaMock.financialAuxiliaryCheckpoint.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_cutoffAt: {
          tenantId: 'tenant-a',
          cutoffAt: new Date('2026-08-23T15:00:00.000Z'),
        },
      },
    });
  });

  it('keeps checkpoints immutable at the PostgreSQL persistence boundary', async () => {
    const migration = await readFile(
      'prisma/migrations/20260824120000_add_accounting_policy_and_auxiliary_checkpoints/migration.sql',
      'utf8',
    );

    expect(migration).toContain('financial_auxiliary_checkpoints_immutable_update');
    expect(migration).toContain('financial_auxiliary_checkpoints_immutable_delete');
    expect(migration).toContain('CHECK ("cutoffAt" <= "capturedAt")');
    expect(migration).toContain('UNIQUE INDEX "financial_auxiliary_checkpoints_tenantId_cutoffAt_key"');
  });
});
