import { describe, expect, it } from 'vitest';

import { canConfirmSalesAgentPayout } from './admin-users-table';

describe('canConfirmSalesAgentPayout', () => {
  it('allows only active sales agents with active profile and positive available balance', () => {
    expect(canConfirmSalesAgentPayout({
      role: 'salesAgent',
      isActive: true,
      salesAgentProfile: { status: 'active' },
      salesAgentBalance: { availableUsd: 0.01 },
    })).toBe(true);
  });

  it.each([
    { role: 'user', isActive: true, profileStatus: 'active', availableUsd: 10 },
    { role: 'salesAgent', isActive: false, profileStatus: 'active', availableUsd: 10 },
    { role: 'salesAgent', isActive: true, profileStatus: 'inactive', availableUsd: 10 },
    { role: 'salesAgent', isActive: true, profileStatus: 'active', availableUsd: 0 },
  ])('rejects an ineligible payout target: %j', ({
    role, isActive, profileStatus, availableUsd,
  }) => {
    expect(canConfirmSalesAgentPayout({
      role,
      isActive,
      salesAgentProfile: { status: profileStatus },
      salesAgentBalance: { availableUsd },
    })).toBe(false);
  });
});
