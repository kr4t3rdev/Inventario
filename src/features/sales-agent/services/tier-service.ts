import { Decimal } from '@/generated/prisma/runtime/library';

const ZERO_RATE = new Decimal(0);
const ENTRY_RATE = new Decimal('0.05');
const GROWTH_RATE = new Decimal('0.07');
const TOP_RATE = new Decimal('0.10');

/**
 * @description Calculates the current sales-agent rate from active referred tenants with a valid license.
 * @param {number} activeReferredTenants - Current count of eligible referred tenants.
 * @returns {Decimal} Dynamic commission rate for the current count.
 */
export function getSalesAgentCommissionRate(
  activeReferredTenants: number,
): Decimal {
  const normalizedCount = Math.max(0, Math.floor(activeReferredTenants));

  if (normalizedCount === 0) {
    return ZERO_RATE;
  }

  if (normalizedCount <= 10) {
    return ENTRY_RATE;
  }

  if (normalizedCount <= 31) {
    return GROWTH_RATE;
  }

  return TOP_RATE;
}

interface ReferredTenantLicenseSnapshot {
  active: boolean;
  expiresAt: Date;
}

interface ReferredTenantSnapshot {
  tenantId: string;
  referralIsActive: boolean;
  licenses: ReferredTenantLicenseSnapshot[];
}

interface SalesAgentTierSnapshot {
  activeReferredTenants: number;
  commissionRate: Decimal;
}

/**
 * @description Counts active referrals whose tenant has a currently valid active license.
 * @param {ReferredTenantSnapshot[]} referrals - Current referral and license snapshots.
 * @param {Date} now - Deterministic instant used to evaluate license validity.
 * @returns {SalesAgentTierSnapshot} Eligible tenant count and dynamic commission rate.
 */
export function calculateSalesAgentTier(
  referrals: ReferredTenantSnapshot[],
  now: Date,
): SalesAgentTierSnapshot {
  const activeReferredTenants = referrals.filter((referral) => {
    if (!referral.referralIsActive) {
      return false;
    }

    return referral.licenses.some(
      (license) => license.active && license.expiresAt.getTime() > now.getTime(),
    );
  }).length;

  return {
    activeReferredTenants,
    commissionRate: getSalesAgentCommissionRate(activeReferredTenants),
  };
}
