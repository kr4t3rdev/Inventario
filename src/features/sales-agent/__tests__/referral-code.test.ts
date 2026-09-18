import { describe, expect, it } from 'vitest';

import {
  generateSalesAgentReferralCode,
  isUniqueConstraintCollision,
} from '@/features/sales-agent/referral-code';

describe('salesAgent referral code', () => {
  it('genera códigos largos con entropía criptográfica', () => {
    const first = generateSalesAgentReferralCode();
    const second = generateSalesAgentReferralCode();

    expect(first).toMatch(/^SA-[A-F0-9]{16}$/);
    expect(second).toMatch(/^SA-[A-F0-9]{16}$/);
    expect(second).not.toBe(first);
  });

  it('solo clasifica P2002 como colisión recuperable', () => {
    expect(isUniqueConstraintCollision({ code: 'P2002' })).toBe(true);
    expect(isUniqueConstraintCollision({ code: 'P2025' })).toBe(false);
    expect(isUniqueConstraintCollision(new Error('failed'))).toBe(false);
  });
});
