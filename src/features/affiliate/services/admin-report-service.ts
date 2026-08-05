import type { AffiliateAdminSummaryRow } from '../types';
import { buildAffiliateCreditSnapshot, sumAvailableAffiliateCredit } from './credit-service';
import { calculateAffiliateTierProgress } from './tier-service';

/**
 * @description Arma una fila de conciliación admin a partir de datos agregados.
 * @param {{ tenantId: string; tenantName: string; referralCode: string; confirmedSalesCount: number; referredTenantsCount: number; lastAppliedCreditUsd: number; planName: string | null; listPriceUsd: number; availableLedgerRows: Array<{ commissionAmount: number; status: string }>; pendingPerkSlots: number; assignedPerksCount: number; }} input - Datos ya agregados.
 * @returns {AffiliateAdminSummaryRow} Fila lista para la tabla admin.
 */
export function buildAffiliateAdminSummaryRow(input: {
  tenantId: string;
  tenantName: string;
  referralCode: string;
  confirmedSalesCount: number;
  referredTenantsCount: number;
  lastAppliedCreditUsd: number;
  planName: string | null;
  currentLicenseId: string | null;
  listPriceUsd: number;
  availableLedgerRows: Array<{ commissionAmount: number; status: string }>;
  pendingPerkSlots: number;
  assignedPerksCount: number;
  nextPendingPerkGrantId: string | null;
}): AffiliateAdminSummaryRow {
  const progress = calculateAffiliateTierProgress(input.confirmedSalesCount);
  const availableCreditUsd = sumAvailableAffiliateCredit(input.availableLedgerRows);
  const creditPreview = buildAffiliateCreditSnapshot({
    listPriceUsd: input.listPriceUsd,
    availableCreditUsd,
  });

  return {
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    referralCode: input.referralCode,
    referredTenantsCount: input.referredTenantsCount,
    confirmedSalesCount: input.confirmedSalesCount,
    currentTier: progress.currentTier.id,
    currentRate: progress.currentRate,
    availableCreditUsd,
    lastAppliedCreditUsd: input.lastAppliedCreditUsd,
    planName: input.planName,
    currentLicenseId: input.currentLicenseId,
    listPriceUsd: creditPreview.listPriceUsd,
    finalPriceUsd: creditPreview.finalPriceUsd,
    pendingPerkSlots: input.pendingPerkSlots,
    assignedPerksCount: input.assignedPerksCount,
    nextPendingPerkGrantId: input.nextPendingPerkGrantId,
  };
}
