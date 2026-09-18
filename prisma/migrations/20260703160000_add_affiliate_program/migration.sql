-- Migration: add affiliate/referral program tables and license credit preview fields

ALTER TABLE "tenant_licenses"
  ADD COLUMN IF NOT EXISTS "maxClientes" INTEGER NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS "listPriceUsd" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "creditAppliedUsd" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "finalPriceUsd" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "creditSnapshotUsd" DECIMAL(10,2);

UPDATE "tenant_licenses" AS tl
SET "maxClientes" = p."maxClientes"
FROM "Plan" AS p
WHERE tl."planId" = p."planId";

UPDATE "Plan" SET "precio" = 35 WHERE lower("nombre") = 'básico' OR lower("nombre") = 'basico';
UPDATE "Plan" SET "precio" = 75 WHERE lower("nombre") = 'profesional';
UPDATE "Plan" SET "precio" = 105 WHERE lower("nombre") = 'empresarial';

CREATE TABLE IF NOT EXISTS "AffiliateProfile" (
  "affiliateProfileId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "referralCode" TEXT NOT NULL,
  "isEligible" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateProfile_pkey" PRIMARY KEY ("affiliateProfileId")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateProfile_tenantId_key" ON "AffiliateProfile"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateProfile_referralCode_key" ON "AffiliateProfile"("referralCode");
CREATE INDEX IF NOT EXISTS "AffiliateProfile_referralCode_idx" ON "AffiliateProfile"("referralCode");

CREATE TABLE IF NOT EXISTS "AffiliateReferral" (
  "referralId" TEXT NOT NULL,
  "referrerTenantId" TEXT NOT NULL,
  "referredTenantId" TEXT NOT NULL,
  "referredPlanId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'registered',
  "firstConfirmedLicenseId" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateReferral_pkey" PRIMARY KEY ("referralId")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateReferral_referredTenantId_key" ON "AffiliateReferral"("referredTenantId");
CREATE INDEX IF NOT EXISTS "AffiliateReferral_referrerTenantId_idx" ON "AffiliateReferral"("referrerTenantId");
CREATE INDEX IF NOT EXISTS "AffiliateReferral_status_idx" ON "AffiliateReferral"("status");

CREATE TABLE IF NOT EXISTS "AffiliateCommissionLedger" (
  "ledgerId" TEXT NOT NULL,
  "referrerTenantId" TEXT NOT NULL,
  "referralId" TEXT NOT NULL,
  "sourceTenantLicenseId" TEXT NOT NULL,
  "appliedToTenantLicenseId" TEXT,
  "basePlanPrice" DECIMAL(10,2) NOT NULL,
  "commissionRate" DECIMAL(5,4) NOT NULL,
  "commissionAmount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'available',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateCommissionLedger_pkey" PRIMARY KEY ("ledgerId")
);
CREATE INDEX IF NOT EXISTS "AffiliateCommissionLedger_referrerTenantId_status_idx" ON "AffiliateCommissionLedger"("referrerTenantId", "status");
CREATE INDEX IF NOT EXISTS "AffiliateCommissionLedger_referralId_idx" ON "AffiliateCommissionLedger"("referralId");

CREATE TABLE IF NOT EXISTS "AffiliateCreditBalance" (
  "affiliateCreditBalanceId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "availableCredit" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "appliedCredit" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "carryOverCredit" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateCreditBalance_pkey" PRIMARY KEY ("affiliateCreditBalanceId")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateCreditBalance_tenantId_key" ON "AffiliateCreditBalance"("tenantId");

CREATE TABLE IF NOT EXISTS "AffiliatePerkGrant" (
  "perkGrantId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "milestone" TEXT NOT NULL,
  "slotIndex" INTEGER NOT NULL,
  "grantedSlots" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending_manual_assignment',
  "assignedFeatureKey" TEXT,
  "assignedAt" TIMESTAMP(3),
  "assignedBy" TEXT,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliatePerkGrant_pkey" PRIMARY KEY ("perkGrantId")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AffiliatePerkGrant_tenantId_milestone_slotIndex_key" ON "AffiliatePerkGrant"("tenantId", "milestone", "slotIndex");
CREATE INDEX IF NOT EXISTS "AffiliatePerkGrant_tenantId_status_idx" ON "AffiliatePerkGrant"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "ReferralPerkCatalog" (
  "referralPerkCatalogId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "adminOnly" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralPerkCatalog_pkey" PRIMARY KEY ("referralPerkCatalogId")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralPerkCatalog_key_key" ON "ReferralPerkCatalog"("key");

CREATE TABLE IF NOT EXISTS "ReferralPerkRequest" (
  "referralPerkRequestId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "adminNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  CONSTRAINT "ReferralPerkRequest_pkey" PRIMARY KEY ("referralPerkRequestId")
);
CREATE INDEX IF NOT EXISTS "ReferralPerkRequest_tenantId_status_idx" ON "ReferralPerkRequest"("tenantId", "status");

ALTER TABLE "AffiliateProfile"
  ADD CONSTRAINT "AffiliateProfile_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AffiliateReferral"
  ADD CONSTRAINT "AffiliateReferral_referrerTenantId_fkey"
  FOREIGN KEY ("referrerTenantId") REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AffiliateReferral_referredTenantId_fkey"
  FOREIGN KEY ("referredTenantId") REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AffiliateReferral_referredPlanId_fkey"
  FOREIGN KEY ("referredPlanId") REFERENCES "Plan"("planId") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AffiliateReferral_firstConfirmedLicenseId_fkey"
  FOREIGN KEY ("firstConfirmedLicenseId") REFERENCES "tenant_licenses"("tenantLicenseId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AffiliateCommissionLedger"
  ADD CONSTRAINT "AffiliateCommissionLedger_referrerTenantId_fkey"
  FOREIGN KEY ("referrerTenantId") REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AffiliateCommissionLedger_referralId_fkey"
  FOREIGN KEY ("referralId") REFERENCES "AffiliateReferral"("referralId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AffiliateCommissionLedger_sourceTenantLicenseId_fkey"
  FOREIGN KEY ("sourceTenantLicenseId") REFERENCES "tenant_licenses"("tenantLicenseId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AffiliateCommissionLedger_appliedToTenantLicenseId_fkey"
  FOREIGN KEY ("appliedToTenantLicenseId") REFERENCES "tenant_licenses"("tenantLicenseId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AffiliateCreditBalance"
  ADD CONSTRAINT "AffiliateCreditBalance_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AffiliatePerkGrant"
  ADD CONSTRAINT "AffiliatePerkGrant_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReferralPerkRequest"
  ADD CONSTRAINT "ReferralPerkRequest_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
