import { describe, expect, it, vi } from 'vitest';

import { classifyAccountingPolicyEvidence } from './accounting-policy-evidence-service';
import {
  createEvidenceClientMock,
  type EvidenceSourceCounts,
} from './__tests__/fixtures/accounting-policy-evidence';

describe('classifyAccountingPolicyEvidence', () => {
  it.each([
    ['checkpoint auxiliar', { checkpoints: 1 }],
    ['snapshot de período aprobado', { snapshots: 1 }],
    ['reconciliación de venta FX v1', { sales: 1 }],
    ['reconciliación de servicio FX v1', { services: 1 }],
    ['reconciliación de gasto FX v1', { expenses: 1 }],
  ])('clasifica PRESENT cuando existe %s', async (_label, counts) => {
    const result = await classifyAccountingPolicyEvidence(
      createEvidenceClientMock(counts),
      'tenant-a',
    );

    expect(result.classification).toBe('PRESENT');
    expect(result.counts).toEqual(expect.objectContaining(counts));
  });

  it('clasifica NONE solo cuando todas las fuentes confiables están vacías', async () => {
    const client = createEvidenceClientMock();

    const result = await classifyAccountingPolicyEvidence(client, 'tenant-a');

    expect(result).toEqual({
      classification: 'NONE',
      counts: { checkpoints: 0, snapshots: 0, sales: 0, services: 0, expenses: 0 },
    });
    expect(client.snapshotPeriodo.count).toHaveBeenCalledWith({
      where: { periodo: { tenantId: 'tenant-a', estado: 'APROBADO' } },
    });
    expect(client.reconciliacionVenta.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', fxEvidenceVersion: 1 },
    });
  });

  it.each([
    'financialAuxiliaryCheckpoint',
    'snapshotPeriodo',
    'reconciliacionVenta',
    'reconciliacionServicio',
    'reconciliacionGasto',
  ])('falla cerrado como REVIEW_REQUIRED si %s no puede consultarse', async (source) => {
    const client = createEvidenceClientMock();
    const target = client[source as keyof typeof client];
    target.count.mockRejectedValueOnce(new Error('source unavailable'));

    const result = await classifyAccountingPolicyEvidence(client, 'tenant-a');

    expect(result.classification).toBe('REVIEW_REQUIRED');
    expect(result.counts).toBeNull();
  });
});
