import { describe, expect, it } from 'vitest';

import {
  AFFILIATE_TIER_DEFINITIONS,
  calculateAffiliateTierProgress,
  getAffiliateCommissionRate,
  getGrantedMilestones,
  getTotalGrantedPerkSlots,
} from '../tier-service';

describe('tier-service', () => {
  it('returns base tier progression for zero confirmed sales', () => {
    const progress = calculateAffiliateTierProgress(0);

    expect(progress.currentTier.id).toBe('tier-1');
    expect(progress.currentRate).toBe(AFFILIATE_TIER_DEFINITIONS[0].commissionRate);
    expect(progress.confirmedSalesCount).toBe(0);
    expect(progress.totalPerkSlots).toBe(0);
    expect(progress.nextTier?.remainingSales).toBe(1);
  });

  it('awards the first tier inside the 1-10 range', () => {
    const progress = calculateAffiliateTierProgress(4);

    expect(progress.currentTier.id).toBe('tier-1');
    expect(progress.currentRate).toBe(0.05);
    expect(progress.totalPerkSlots).toBe(1);
    expect(progress.nextTier?.tier.id).toBe('tier-2');
    expect(progress.nextTier?.remainingSales).toBe(7);
  });

  it('moves to the second tier at 11 confirmed sales', () => {
    const progress = calculateAffiliateTierProgress(11);

    expect(progress.currentTier.id).toBe('tier-2');
    expect(progress.currentRate).toBe(0.07);
    expect(progress.totalPerkSlots).toBe(3);
    expect(getGrantedMilestones(11)).toEqual(['tier-1', 'tier-2']);
  });

  it('moves to the top tier and accumulates perk slots', () => {
    const progress = calculateAffiliateTierProgress(51);

    expect(progress.currentTier.id).toBe('tier-3');
    expect(progress.currentRate).toBe(0.1);
    expect(progress.totalPerkSlots).toBe(6);
    expect(progress.nextTier).toBeNull();
  });

  it('exposes simple helpers for rate and perk slots', () => {
    expect(getAffiliateCommissionRate(10)).toBe(0.05);
    expect(getAffiliateCommissionRate(50)).toBe(0.07);
    expect(getAffiliateCommissionRate(99)).toBe(0.1);
    expect(getTotalGrantedPerkSlots(99)).toBe(6);
  });
});
