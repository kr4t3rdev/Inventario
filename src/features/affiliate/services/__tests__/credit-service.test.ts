import { describe, expect, it } from 'vitest';

import {
  applyCreditToPrice,
  buildAffiliateCreditSnapshot,
  sumAvailableAffiliateCredit,
} from '../credit-service';

describe('credit-service', () => {
  it('applies partial credit to a plan price', () => {
    expect(applyCreditToPrice({ listPriceUsd: 75, availableCreditUsd: 20 })).toEqual({
      listPriceUsd: 75,
      availableCreditUsd: 20,
      creditAppliedUsd: 20,
      finalPriceUsd: 55,
      carryOverCreditUsd: 0,
    });
  });

  it('carries over credit that exceeds the plan price', () => {
    expect(applyCreditToPrice({ listPriceUsd: 35, availableCreditUsd: 50 })).toEqual({
      listPriceUsd: 35,
      availableCreditUsd: 50,
      creditAppliedUsd: 35,
      finalPriceUsd: 0,
      carryOverCreditUsd: 15,
    });
  });

  it('sums only available ledger rows', () => {
    expect(
      sumAvailableAffiliateCredit([
        { commissionAmount: 10, status: 'available' },
        { commissionAmount: 5, status: 'pending' },
        { commissionAmount: 8.5, status: 'available' },
      ]),
    ).toBe(18.5);
  });

  it('builds a snapshot payload ready for TenantLicense preview fields', () => {
    expect(
      buildAffiliateCreditSnapshot({
        listPriceUsd: 105,
        availableCreditUsd: 14,
      }),
    ).toEqual({
      listPriceUsd: 105,
      availableCreditUsd: 14,
      creditSnapshotUsd: 14,
      creditAppliedUsd: 14,
      finalPriceUsd: 91,
      carryOverCreditUsd: 0,
    });
  });
});
