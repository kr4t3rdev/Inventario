import type { AffiliateTierDefinition } from './types';

export const AFFILIATE_TIER_DEFINITIONS: AffiliateTierDefinition[] = [
  {
    id: 'tier-1',
    minSalesInclusive: 1,
    maxSalesInclusive: 10,
    commissionRate: 0.05,
    perkSlotsGranted: 1,
  },
  {
    id: 'tier-2',
    minSalesInclusive: 11,
    maxSalesInclusive: 50,
    commissionRate: 0.07,
    perkSlotsGranted: 2,
  },
  {
    id: 'tier-3',
    minSalesInclusive: 51,
    maxSalesInclusive: null,
    commissionRate: 0.1,
    perkSlotsGranted: 3,
  },
];

export const AFFILIATE_DEFAULT_CURRENCY = 'USD';
export const REFERRAL_FEATURE_NAMESPACE = 'referral-';
