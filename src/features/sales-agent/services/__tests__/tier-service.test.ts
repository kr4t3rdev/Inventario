import { describe, expect, it } from 'vitest';

import {
  calculateSalesAgentTier,
  getSalesAgentCommissionRate,
} from '../tier-service';

describe('getSalesAgentCommissionRate', () => {
  it.each([
    { activeReferredTenants: 0, expectedRate: '0' },
    { activeReferredTenants: 1, expectedRate: '0.03' },
    { activeReferredTenants: 10, expectedRate: '0.03' },
    { activeReferredTenants: 11, expectedRate: '0.05' },
    { activeReferredTenants: 31, expectedRate: '0.05' },
    { activeReferredTenants: 32, expectedRate: '0.07' },
  ])(
    'returns $expectedRate for $activeReferredTenants active referred tenants',
    ({ activeReferredTenants, expectedRate }) => {
      expect(getSalesAgentCommissionRate(activeReferredTenants).toString()).toBe(expectedRate);
    },
  );

  it('recalculates a lower tier when the active referred tenant count decreases', () => {
    expect(getSalesAgentCommissionRate(32).toString()).toBe('0.07');
    expect(getSalesAgentCommissionRate(31).toString()).toBe('0.05');
    expect(getSalesAgentCommissionRate(10).toString()).toBe('0.03');
    expect(getSalesAgentCommissionRate(0).toString()).toBe('0');
  });
});

describe('calculateSalesAgentTier', () => {
  const now = new Date('2026-07-27T12:00:00.000Z');

  it('counts only active referred tenants with at least one valid active license', () => {
    const result = calculateSalesAgentTier(
      [
        {
          tenantId: 'eligible',
          referralIsActive: true,
          licenses: [{ active: true, expiresAt: new Date('2026-07-28T00:00:00.000Z') }],
        },
        {
          tenantId: 'inactive-tenant',
          referralIsActive: false,
          licenses: [{ active: true, expiresAt: new Date('2026-07-28T00:00:00.000Z') }],
        },
        {
          tenantId: 'expired-license',
          referralIsActive: true,
          licenses: [{ active: true, expiresAt: new Date('2026-07-27T11:59:59.999Z') }],
        },
        {
          tenantId: 'inactive-license',
          referralIsActive: true,
          licenses: [{ active: false, expiresAt: new Date('2026-07-28T00:00:00.000Z') }],
        },
      ],
      now,
    );

    expect(result.activeReferredTenants).toBe(1);
    expect(result.commissionRate.toString()).toBe('0.03');
  });

  it('drops the tier when a referred tenant license is no longer valid', () => {
    const referrals = Array.from({ length: 11 }, (_, index) => ({
      tenantId: `tenant-${index}`,
      referralIsActive: true,
      licenses: [{ active: true, expiresAt: new Date('2026-07-28T00:00:00.000Z') }],
    }));

    expect(calculateSalesAgentTier(referrals, now).commissionRate.toString()).toBe('0.05');

    const afterExpiration = new Date('2026-07-28T00:00:00.001Z');
    expect(
      calculateSalesAgentTier(referrals, afterExpiration).commissionRate.toString(),
    ).toBe('0');
  });
});
