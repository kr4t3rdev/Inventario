import { describe, expect, it } from 'vitest';

import {
  REFERRAL_ALLOWED_FEATURE_KEYS,
  assertReferralFeatureKey,
  getReferralPerkCatalog,
  isCommercialFeatureKey,
} from '../perk-service';

describe('perk-service', () => {
  it('accepts only referral namespaced feature keys from the catalog', () => {
    const key = REFERRAL_ALLOWED_FEATURE_KEYS[0];

    expect(assertReferralFeatureKey(key)).toBe(key);
    expect(isCommercialFeatureKey(key)).toBe(false);
  });

  it('rejects commercial feature keys reused as perks', () => {
    expect(() => assertReferralFeatureKey('clientes')).toThrow(/programa de referidos/i);
  });

  it('rejects unknown referral feature keys', () => {
    expect(() => assertReferralFeatureKey('referral-made-up-feature')).toThrow(/catálogo/i);
  });

  it('returns only active catalog entries', () => {
    expect(getReferralPerkCatalog().length).toBeGreaterThan(0);
    expect(getReferralPerkCatalog().every((item) => item.isActive)).toBe(true);
  });
});
