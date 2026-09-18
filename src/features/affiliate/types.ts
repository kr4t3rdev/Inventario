/**
 * @description Tipos públicos del dominio de referidos/afiliados.
 */

export type AffiliateTierId = 'tier-1' | 'tier-2' | 'tier-3';
export type AffiliateReferralStatus = 'registered' | 'confirmed' | 'credited' | 'canceled';
export type AffiliateLedgerStatus = 'pending' | 'available' | 'applied' | 'canceled';
export type AffiliatePerkGrantStatus = 'pending_manual_assignment' | 'assigned';
export type ReferralPerkRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AffiliateTierDefinition {
  id: AffiliateTierId;
  minSalesInclusive: number;
  maxSalesInclusive: number | null;
  commissionRate: number;
  perkSlotsGranted: number;
}

export interface AffiliateTierProgress {
  confirmedSalesCount: number;
  currentTier: AffiliateTierDefinition;
  currentRate: number;
  totalPerkSlots: number;
  grantedMilestones: AffiliateTierId[];
  nextTier: {
    tier: AffiliateTierDefinition;
    remainingSales: number;
  } | null;
}

export interface AffiliateCreditComputation {
  listPriceUsd: number;
  availableCreditUsd: number;
  creditAppliedUsd: number;
  finalPriceUsd: number;
  carryOverCreditUsd: number;
}

export interface AffiliateCreditSnapshot extends AffiliateCreditComputation {
  creditSnapshotUsd: number;
}

export interface ReferralPerkCatalogItem {
  key: string;
  label: string;
  description: string;
  isActive: boolean;
  adminOnly: boolean;
}

export interface AffiliateSummary {
  tenantId: string;
  referralCode: string;
  confirmedSalesCount: number;
  currentTier: AffiliateTierId;
  currentRate: number;
  creditAvailableUsd: number;
  totalPerkSlots: number;
  assignedPerksCount: number;
  pendingPerkSlots: number;
  nextLicensePreview: AffiliateCreditSnapshot | null;
  referralLink: string;
  referredTenants: Array<{
    referralId: string;
    tenantId: string;
    tenantName: string;
    status: AffiliateReferralStatus;
    confirmedAt: string | null;
  }>;
  perkGrants: ReferralPerkGrantRow[];
  customRequests: Array<{
    referralPerkRequestId: string;
    title: string;
    status: ReferralPerkRequestStatus;
    createdAt: string;
  }>;
}

export interface AffiliateReferralRow {
  referralId: string;
  referrerTenantId: string;
  referrerTenantName: string;
  referredTenantId: string;
  referredTenantName: string;
  referredPlanName: string | null;
  referredCurrentLicenseId: string | null;
  status: AffiliateReferralStatus;
  confirmedAt: string | null;
}

export interface AffiliateLedgerRow {
  ledgerId: string;
  referrerTenantId: string;
  referrerTenantName: string;
  referredTenantId: string;
  referredTenantName: string;
  commissionRate: number;
  commissionAmount: number;
  currency: string;
  status: AffiliateLedgerStatus;
  createdAt: string;
}

export interface ReferralPerkGrantRow {
  perkGrantId: string;
  milestone: AffiliateTierId;
  grantedSlots: number;
  status: AffiliatePerkGrantStatus;
  assignedFeatureKey: string | null;
  grantedAt: string;
  assignedAt: string | null;
}

export interface AffiliateAdminSummaryRow {
  tenantId: string;
  tenantName: string;
  referralCode: string;
  referredTenantsCount: number;
  confirmedSalesCount: number;
  currentTier: AffiliateTierId;
  currentRate: number;
  availableCreditUsd: number;
  lastAppliedCreditUsd: number;
  planName: string | null;
  currentLicenseId: string | null;
  listPriceUsd: number;
  finalPriceUsd: number;
  pendingPerkSlots: number;
  assignedPerksCount: number;
  nextPendingPerkGrantId: string | null;
}
