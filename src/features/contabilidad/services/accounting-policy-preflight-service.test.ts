import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  classifyTenantAccountingPolicyState,
  preflightTenantAccountingPolicies,
  preflightAccountingPoliciesForRollout,
} from '@/features/contabilidad/services/accounting-policy-preflight-service';

const evidenceMock = vi.hoisted(() => vi.fn());
const rolloutCapabilityMock = vi.hoisted(() => vi.fn());
const gaugeRefreshMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  tenantAccountingPolicy: { findUnique: vi.fn() },
}));

vi.mock('@/features/contabilidad/services/accounting-policy-evidence-service', () => ({
  classifyAccountingPolicyEvidence: evidenceMock,
}));
vi.mock('@/lib/auth/accounting-policy-capabilities', () => ({
  canRunAccountingPolicyRollout: rolloutCapabilityMock,
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/metrics', () => ({
  refreshOperationalTenantsWithoutAccountingPolicy: gaugeRefreshMock,
}));

describe('accounting policy preflight service', () => {
  const client = {
    tenantAccountingPolicy: { findUnique: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clasifica una política existente sin inspeccionar evidencia', async () => {
    client.tenantAccountingPolicy.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      functionalCurrencyCode: 'CUP',
    });

    await expect(classifyTenantAccountingPolicyState(client as never, 'tenant-a'))
      .resolves.toEqual({
        tenantId: 'tenant-a',
        classification: 'POLICY_PRESENT',
        existingCurrencyCode: 'CUP',
      });
    expect(evidenceMock).not.toHaveBeenCalled();
  });

  it.each([
    ['NONE', 'MISSING_NO_EVIDENCE'],
    ['PRESENT', 'MISSING_WITH_EVIDENCE'],
    ['REVIEW_REQUIRED', 'REVIEW_REQUIRED'],
  ] as const)('mapea evidencia %s a %s', async (evidence, expected) => {
    client.tenantAccountingPolicy.findUnique.mockResolvedValue(null);
    evidenceMock.mockResolvedValue({ classification: evidence, counts: null });

    await expect(classifyTenantAccountingPolicyState(client as never, 'tenant-a'))
      .resolves.toEqual({ tenantId: 'tenant-a', classification: expected });
  });

  it('inspecciona cada tenant exactamente una vez y concilia el resumen', async () => {
    client.tenantAccountingPolicy.findUnique.mockResolvedValue(null);
    evidenceMock
      .mockResolvedValueOnce({ classification: 'NONE', counts: null })
      .mockResolvedValueOnce({ classification: 'PRESENT', counts: null });

    const result = await preflightTenantAccountingPolicies(
      client as never,
      ['tenant-a', 'tenant-a', 'tenant-b'],
    );

    expect(result.entries).toEqual([
      { tenantId: 'tenant-a', classification: 'MISSING_NO_EVIDENCE' },
      { tenantId: 'tenant-b', classification: 'MISSING_WITH_EVIDENCE' },
    ]);
    expect(result.summary).toEqual({
      inspected: 2,
      policyPresent: 0,
      missingNoEvidence: 1,
      missingWithEvidence: 1,
      reviewRequired: 0,
    });
  });

  it('rechaza el preflight cross-tenant sin capacidad efectiva', async () => {
    rolloutCapabilityMock.mockResolvedValue(false);

    await expect(preflightAccountingPoliciesForRollout('operator-a', ['tenant-a']))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prismaMock.tenantAccountingPolicy.findUnique).not.toHaveBeenCalled();
  });

  it('actualiza el gauge después de un preflight autorizado', async () => {
    rolloutCapabilityMock.mockResolvedValue(true);
    prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue(null);
    evidenceMock.mockResolvedValue({ classification: 'NONE', counts: null });

    await preflightAccountingPoliciesForRollout('operator-a', ['tenant-a']);

    expect(gaugeRefreshMock).toHaveBeenCalledWith(prismaMock);
  });

  it('limita la concurrencia de inspección', async () => {
    let active = 0;
    let maxActive = 0;
    client.tenantAccountingPolicy.findUnique.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { tenantId: 'present', functionalCurrencyCode: 'CUP' };
    });

    await preflightTenantAccountingPolicies(
      client as never,
      ['tenant-a', 'tenant-b', 'tenant-c'],
      { batchSize: 2 },
    );

    expect(maxActive).toBe(2);
  });
});
