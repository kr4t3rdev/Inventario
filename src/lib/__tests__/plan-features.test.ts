import { describe, expect, it } from 'vitest';

import {
  diffPlanFeaturesToOverrides,
  resolveEffectivePlanFeatures,
} from '@/lib/plan-features';

describe('resolveEffectivePlanFeatures', () => {
  it('merges plan features with explicit license overrides', () => {
    expect(
      resolveEffectivePlanFeatures({
        planFeatures: { contabilidad: true, 'reportes-financieros': true },
        featureOverrides: { 'reportes-financieros': false },
      }),
    ).toEqual({ contabilidad: true, 'reportes-financieros': false });
  });

  it('falls back to legacy snapshot when overrides are absent', () => {
    expect(
      resolveEffectivePlanFeatures({
        planFeatures: { contabilidad: true },
        legacyLicenseFeatures: { contabilidad: false, clientes: true },
      }),
    ).toEqual({ contabilidad: false, clientes: true });
  });
});

describe('diffPlanFeaturesToOverrides', () => {
  it('stores only differences against the plan', () => {
    expect(
      diffPlanFeaturesToOverrides({
        planFeatures: { contabilidad: true, clientes: false },
        legacyLicenseFeatures: { contabilidad: true, clientes: true },
      }),
    ).toEqual({ clientes: true });
  });
});
