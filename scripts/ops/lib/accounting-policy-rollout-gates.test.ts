import { describe, expect, it } from 'vitest';

import {
  assertAccountingPolicyRolloutGates,
  type AccountingPolicyRolloutGates,
} from './accounting-policy-rollout-gates';

const completeGates: AccountingPolicyRolloutGates = {
  capabilityMappings: { verified: true, evidenceRef: 'capability-check-2026-08-26' },
  tenantResponsibles: { verified: true, evidenceRef: 'tenant-owners-2026-08-26' },
  databaseBackup: { verified: true, evidenceRef: 'backup-check-2026-08-26' },
  pilot: { verified: true, evidenceRef: 'pilot-report-2026-08-26' },
};

describe('accounting policy rollout production gates', () => {
  it('accepts all explicit verified proofs', () => {
    expect(() => assertAccountingPolicyRolloutGates(completeGates)).not.toThrow();
  });

  it.each([
    'capabilityMappings',
    'tenantResponsibles',
    'databaseBackup',
    'pilot',
  ] as const)('rejects apply when %s proof is missing', (gate) => {
    const incomplete = {
      ...completeGates,
      [gate]: { verified: false, evidenceRef: '' },
    };

    expect(() => assertAccountingPolicyRolloutGates(incomplete)).toThrowError(
      expect.objectContaining({ code: 'ROLLOUT_NOT_READY' }),
    );
  });

  it('fails closed when the gate configuration is absent', () => {
    expect(() => assertAccountingPolicyRolloutGates(undefined)).toThrowError(
      expect.objectContaining({ code: 'ROLLOUT_NOT_READY' }),
    );
  });
});
