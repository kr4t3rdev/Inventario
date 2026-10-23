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

  it('legacy snapshot only fills keys the plan does not define', () => {
    expect(
      resolveEffectivePlanFeatures({
        planFeatures: { contabilidad: true },
        legacyLicenseFeatures: { contabilidad: false, clientes: true },
      }),
    ).toEqual({ contabilidad: true, clientes: true });
  });

  it('keeps plan keys that are absent from the legacy snapshot', () => {
    expect(
      resolveEffectivePlanFeatures({
        planFeatures: {
          contabilidad: true,
          'ordenes-compra': false,
          recepciones: false,
          reabastecimiento: false,
        },
        legacyLicenseFeatures: { contabilidad: true },
      }),
    ).toEqual({
      contabilidad: true,
      'ordenes-compra': false,
      recepciones: false,
      reabastecimiento: false,
    });
  });

  it('explicit overrides win over the legacy snapshot and the plan', () => {
    expect(
      resolveEffectivePlanFeatures({
        planFeatures: { contabilidad: true, clientes: false },
        legacyLicenseFeatures: { clientes: true },
        featureOverrides: { clientes: false },
      }),
    ).toEqual({ contabilidad: true, clientes: false });
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
