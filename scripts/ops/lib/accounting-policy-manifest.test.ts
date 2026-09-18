import { describe, expect, it } from 'vitest';

import {
  getAccountingPolicyManifestHash,
  parseAccountingPolicyManifest,
} from './accounting-policy-manifest';

const manifest = {
  version: 1 as const,
  reason: 'Remediación aprobada',
  platformApproval: {
    approverUserId: 'approver-a',
    reference: 'CAB-123',
    approvedAt: '2026-08-25T12:00:00.000Z',
  },
  entries: [
    {
      tenantId: 'tenant-b',
      functionalCurrencyCode: 'CUP',
      expectedClassification: 'MISSING_NO_EVIDENCE' as const,
      origin: 'ROLLOUT' as const,
      reason: 'CUP confirmada explícitamente',
    },
    {
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'USD',
      expectedClassification: 'MISSING_WITH_EVIDENCE' as const,
      origin: 'ROLLOUT' as const,
      reason: 'USD aprobada individualmente',
      tenantApprovalId: 'approval-a',
    },
  ],
};

describe('accounting policy manifest', () => {
  it('acepta CUP solo como literal explícito y produce un hash estable', () => {
    const parsed = parseAccountingPolicyManifest(manifest);
    const reordered = { ...manifest, entries: [...manifest.entries].reverse() };

    expect(parsed.entries[0].functionalCurrencyCode).toBe('CUP');
    expect(getAccountingPolicyManifestHash(parsed)).toBe(
      getAccountingPolicyManifestHash(parseAccountingPolicyManifest(reordered)),
    );
  });

  it.each(['', '*', 'DEFAULT', 'PRIMARY'])('rechaza moneda implícita %j', (currency) => {
    const invalid = {
      ...manifest,
      entries: [{ ...manifest.entries[0], functionalCurrencyCode: currency }],
    };

    expect(() => parseAccountingPolicyManifest(invalid)).toThrow();
  });

  it('rechaza tenants duplicados antes de cualquier operación', () => {
    const duplicate = {
      ...manifest,
      entries: [manifest.entries[0], { ...manifest.entries[0], functionalCurrencyCode: 'USD' }],
    };

    expect(() => parseAccountingPolicyManifest(duplicate)).toThrow(/tenant duplicado/i);
  });

  it('cambia el hash cuando cambia el contenido aprobado', () => {
    const changed = { ...manifest, reason: 'Otra remediación aprobada' };

    expect(getAccountingPolicyManifestHash(parseAccountingPolicyManifest(manifest))).not.toBe(
      getAccountingPolicyManifestHash(parseAccountingPolicyManifest(changed)),
    );
  });
});
