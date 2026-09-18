import { describe, expect, it } from 'vitest';

import { buildLicenseOverrideBackfill } from '../backfill-license-feature-overrides';

describe('backfill-license-feature-overrides', () => {
  it('converts legacy snapshot deltas into minimal overrides', () => {
    expect(
      buildLicenseOverrideBackfill({
        planFeatures: { contabilidad: true, clientes: false },
        legacyLicenseFeatures: { contabilidad: true, clientes: true },
      }),
    ).toEqual({
      features: null,
      featureOverrides: { clientes: true },
    });
  });

  it('keeps empty overrides when legacy snapshot matches the plan', () => {
    expect(
      buildLicenseOverrideBackfill({
        planFeatures: { contabilidad: true },
        legacyLicenseFeatures: { contabilidad: true },
      }),
    ).toEqual({
      features: null,
      featureOverrides: {},
    });
  });
});
