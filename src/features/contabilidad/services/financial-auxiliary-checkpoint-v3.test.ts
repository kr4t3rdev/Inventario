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

const auxiliary = {
  sourceId: 'bank-1',
  sourceType: 'BANK_ACCOUNT',
  status: 'ACTIVE',
  identity: { name: 'Cuenta principal', accountType: 'CHECKING' },
  originalAmount: '100.00',
  originalCurrency: 'USD',
  functionalAmount: '2500.00',
  functionalCurrency: 'CUP',
  fxEvidence: {
    kind: 'GLOBAL_CATALOG_DIRECT',
    effectiveAt: '2025-12-31T20:00:00.000Z',
    source: 'global-catalog',
    fingerprint: 'fx-fingerprint',
  },
  evidenceFingerprint: 'bank-fingerprint',
};

describe('financial auxiliary checkpoint v3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ cutoffAt: new Date('2026-01-01T00:00:00.000Z') }])
      .mockResolvedValueOnce([{ capturedAt: new Date('2026-01-01T00:00:01.000Z') }]);
    prismaMock.financialAuxiliaryCheckpoint.create.mockImplementation(async ({ data }) => ({
      checkpointId: 'checkpoint-v3',
      ...data,
    }));
  });

  it('captures v3 native auxiliary identity, amounts, FX provenance and tenant identity', async () => {
    const { captureFinancialAuxiliaryCheckpoint } = await import(
      './financial-auxiliary-checkpoint-service',
    );
    const checkpoint = await captureFinancialAuxiliaryCheckpoint({
      tenantId: 'tenant-a',
      capturedBy: 'user-a',
      schemaVersion: 3,
      collectEvidence: vi.fn().mockResolvedValue({
        functionalCurrency: 'CUP',
        balance: { total: '2500.00' },
        result: { net: '0.00' },
        resultThrough: '2026-01-01T00:00:00.000Z',
        sourceFingerprints: { banks: 'banks-fingerprint' },
        appliedFxEvidence: [auxiliary.fxEvidence],
        auxiliaries: {
          bankAccounts: [auxiliary],
          inventory: [],
          receivables: [],
          payables: [],
          debt: [],
          capital: [],
        },
      }),
    });

    expect(checkpoint.payload).toMatchObject({
      version: 3,
      tenantId: 'tenant-a',
      cutoffAt: '2026-01-01T00:00:00.000Z',
      auxiliaries: { bankAccounts: [auxiliary] },
    });
    expect(checkpoint.hashIntegridad).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects incomplete v3 evidence instead of persisting a false complete payload', async () => {
    const { captureFinancialAuxiliaryCheckpoint } = await import(
      './financial-auxiliary-checkpoint-service',
    );
    await expect(captureFinancialAuxiliaryCheckpoint({
      tenantId: 'tenant-a',
      capturedBy: 'user-a',
      schemaVersion: 3,
      collectEvidence: vi.fn().mockResolvedValue({
        functionalCurrency: 'CUP',
        balance: {},
        result: {},
        resultThrough: '2026-01-01T00:00:00.000Z',
        sourceFingerprints: {},
        appliedFxEvidence: [],
      }),
    })).rejects.toMatchObject({ code: 'CHECKPOINT_PAYLOAD_INCOMPLETE' });
    expect(prismaMock.financialAuxiliaryCheckpoint.create).not.toHaveBeenCalled();
  });

  it('keeps v1 legacy checkpoints readable without presenting them as v3', async () => {
    const { findFinancialAuxiliaryCheckpoint } = await import(
      './financial-auxiliary-checkpoint-service',
    );
    const payload = {
      version: 1,
      cutoffAt: '2026-01-01T00:00:00.000Z',
      capturedAt: '2026-01-01T00:00:01.000Z',
      resultThrough: '2026-01-01T00:00:00.000Z',
      functionalCurrency: 'CUP',
      balance: {},
      result: {},
      sourceFingerprints: {},
      appliedFxEvidence: [],
    };
    const { hashImmutableFinancialEvidence } = await import('./immutable-financial-evidence');
    prismaMock.financialAuxiliaryCheckpoint.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      cutoffAt: new Date(payload.cutoffAt),
      capturedAt: new Date(payload.capturedAt),
      functionalCurrencyCode: 'CUP',
      payload,
      hashIntegridad: hashImmutableFinancialEvidence(payload),
    });

    const checkpoint = await findFinancialAuxiliaryCheckpoint({
      tenantId: 'tenant-a',
      cutoffAt: new Date(payload.cutoffAt),
    });
    expect(checkpoint?.payload.version).toBe(1);
    expect((checkpoint?.payload as Record<string, unknown>).tenantId).toBeUndefined();
  });

  it('documents the v3 checkpoint schema version as additive and indexed', async () => {
    const schema = await readFile('prisma/schema.prisma', 'utf8');
    const migration = await readFile(
      'prisma/migrations/20260824121000_add_financial_snapshot_v3/migration.sql',
      'utf8',
    );
    expect(schema).toMatch(/schemaVersion\s+Int\?/);
    expect(migration).toContain(
      'financial_auxiliary_checkpoints_tenantId_schemaVersion_cutoffAt_idx',
    );
  });
});
