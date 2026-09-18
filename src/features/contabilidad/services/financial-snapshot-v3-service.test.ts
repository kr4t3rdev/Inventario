import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  snapshotPeriodo: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const completeInput = () => ({
  tenantId: 'tenant-a',
  periodoId: 'period-2026',
  version: 1,
  cutoffAt: new Date('2026-01-01T00:00:00.000Z'),
  capturedAt: new Date('2026-01-01T00:00:01.000Z'),
  canonicalContractVersion: 'financial-report.v3',
  range: {
    gte: '2025-01-01T00:00:00.000Z',
    lt: '2026-01-01T00:00:00.000Z',
  },
  functionalCurrency: 'CUP',
  balance: { assets: { total: '100.00' } },
  result: { net: '10.00' },
  cashFlow: { operating: { grossInflow: '20.00', grossOutflow: '10.00', net: '10.00' } },
  coverage: {
    candidates: { included: 1, unresolved: 0, excluded: 0 },
    stages: { normalized: 1, classified: 1, linked: 1 },
    estimated: 0,
  },
  provenance: {
    appliedFxEvidence: [],
    sourceFingerprints: { banks: 'banks-fingerprint' },
  },
});

describe('financial snapshot v3 service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
  });

  it('builds a complete v3 payload with an exact semi-open cutoff and deterministic hash', async () => {
    const {
      createFinancialSnapshotV3,
      hashFinancialSnapshotV3,
    } = await import('./financial-snapshot-v3-service');
    const input = completeInput();

    const first = createFinancialSnapshotV3(input);
    const second = createFinancialSnapshotV3({
      ...input,
      provenance: { sourceFingerprints: { banks: 'banks-fingerprint' }, appliedFxEvidence: [] },
    });

    expect(first.payload.version).toBe(3);
    expect(first.payload.cutoffAt).toBe(input.cutoffAt.toISOString());
    expect(first.payload.range.lt).toBe(first.payload.cutoffAt);
    expect(first.hash).toBe(hashFinancialSnapshotV3(second.payload));
  });

  it('rejects incomplete canonical evidence before persistence', async () => {
    const { captureFinancialSnapshotV3 } = await import('./financial-snapshot-v3-service');
    const incomplete = { ...completeInput(), coverage: undefined };

    await expect(captureFinancialSnapshotV3(incomplete)).rejects.toMatchObject({
      code: 'INVALID_SNAPSHOT_PAYLOAD',
    });
    expect(prismaMock.snapshotPeriodo.create).not.toHaveBeenCalled();
  });

  it('resolves snapshots only with the requested tenant predicate', async () => {
    const { findFinancialSnapshotV3 } = await import('./financial-snapshot-v3-service');

    prismaMock.snapshotPeriodo.findFirst.mockResolvedValue(null);
    await expect(findFinancialSnapshotV3({
      tenantId: 'tenant-a',
      snapshotId: 'snapshot-from-b',
    })).resolves.toBeNull();

    expect(prismaMock.snapshotPeriodo.findFirst).toHaveBeenCalledWith({
      where: {
        snapshotId: 'snapshot-from-b',
        tenantId: 'tenant-a',
        schemaVersion: 3,
        status: 'APPROVED',
      },
    });
  });

  it('approves once and returns the persisted result on an idempotent retry', async () => {
    const {
      captureFinancialSnapshotV3,
      approveFinancialSnapshotV3,
    } = await import('./financial-snapshot-v3-service');
    const input = completeInput();
    const captured = {
      snapshotId: 'snapshot-1',
      ...input,
      schemaVersion: 3,
      status: 'CAPTURED',
      resumenJson: createCapturedPayload(input),
      hashIntegridad: 'capture-hash',
    };
    const { hashFinancialSnapshotV3 } = await import('./financial-snapshot-v3-service');
    captured.hashIntegridad = hashFinancialSnapshotV3(captured.resumenJson);
    prismaMock.snapshotPeriodo.create.mockResolvedValue(captured);

    await captureFinancialSnapshotV3(input);
    prismaMock.snapshotPeriodo.updateMany.mockResolvedValue({ count: 1 });
    const approvedPayload = {
      ...captured.resumenJson,
      approvedAt: '2026-01-01T00:00:02.000Z',
    };
    prismaMock.snapshotPeriodo.findFirst.mockResolvedValueOnce(captured);
    prismaMock.snapshotPeriodo.findFirst.mockResolvedValueOnce({
      ...captured,
      status: 'APPROVED',
      approvedAt: new Date('2026-01-01T00:00:02.000Z'),
      approvedBy: 'user-a',
      resumenJson: approvedPayload,
      hashIntegridad: hashFinancialSnapshotV3(approvedPayload),
    });

    const approved = await approveFinancialSnapshotV3({
      tenantId: 'tenant-a',
      snapshotId: 'snapshot-1',
      approvedAt: new Date('2026-01-01T00:00:02.000Z'),
      approvedBy: 'user-a',
    });
    prismaMock.snapshotPeriodo.findFirst.mockResolvedValueOnce(approved);

    await expect(approveFinancialSnapshotV3({
      tenantId: 'tenant-a',
      snapshotId: 'snapshot-1',
      approvedAt: new Date('2026-01-01T00:00:02.000Z'),
      approvedBy: 'user-a',
    })).resolves.toMatchObject({ status: 'APPROVED' });
    expect(prismaMock.snapshotPeriodo.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does not mutate the stored v2 payload or treat it as v3 evidence', async () => {
    const migration = await readFile(
      'prisma/migrations/20260824121000_add_financial_snapshot_v3/migration.sql',
      'utf8',
    );
    const { isFinancialSnapshotV3Payload } = await import('./financial-snapshot-v3-service');
    const legacyPayload = { version: 2, balance: { total: 10 } };

    expect(isFinancialSnapshotV3Payload(legacyPayload)).toBe(false);
    expect(legacyPayload).toEqual({ version: 2, balance: { total: 10 } });
    expect(migration).toContain('snapshot_periodos_approved_immutable_update');
    expect(migration).toContain('snapshot_periodos_approved_immutable_delete');
  });
});

function createCapturedPayload(input: ReturnType<typeof completeInput>) {
  return {
    version: 3,
    tenantId: input.tenantId,
    cutoffAt: input.cutoffAt.toISOString(),
    capturedAt: input.capturedAt.toISOString(),
    range: input.range,
    functionalCurrency: input.functionalCurrency,
    canonicalContractVersion: input.canonicalContractVersion,
    balance: input.balance,
    result: input.result,
    cashFlow: input.cashFlow,
    coverage: input.coverage,
    provenance: input.provenance,
  };
}
