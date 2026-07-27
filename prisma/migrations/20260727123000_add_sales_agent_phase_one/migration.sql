-- CreateTable
CREATE TABLE "SalesAgentProfile" (
    "salesAgentProfileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referralCode" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_approval',
    "approvedAt" TIMESTAMP(3),
    "approvedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesAgentProfile_pkey" PRIMARY KEY ("salesAgentProfileId")
);

-- CreateTable
CREATE TABLE "SalesAgentReferral" (
    "salesAgentReferralId" TEXT NOT NULL,
    "salesAgentUserId" TEXT NOT NULL,
    "referredTenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'attributed',
    "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesAgentReferral_pkey" PRIMARY KEY ("salesAgentReferralId")
);

-- CreateTable
CREATE TABLE "TenantLicensePayment" (
    "tenantLicensePaymentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantLicenseId" TEXT NOT NULL,
    "paymentKind" TEXT NOT NULL,
    "expectedAmountUsd" DECIMAL(12,2) NOT NULL,
    "amountPaidUsd" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "idempotencyKey" TEXT NOT NULL,
    "immutableFingerprint" TEXT NOT NULL,
    "paymentCycleEndsAt" TIMESTAMP(3) NOT NULL,
    "licenseExpirationSnapshot" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantLicensePayment_pkey" PRIMARY KEY ("tenantLicensePaymentId"),
    CONSTRAINT "TenantLicensePayment_kind_check" CHECK ("paymentKind" IN ('initial', 'renewal')),
    CONSTRAINT "TenantLicensePayment_status_check" CHECK ("status" = 'confirmed'),
    CONSTRAINT "TenantLicensePayment_amount_check"
      CHECK ("expectedAmountUsd" > 0 AND "amountPaidUsd" = "expectedAmountUsd")
);

-- CreateTable
CREATE TABLE "SalesAgentCommissionLedger" (
    "salesAgentCommissionLedgerId" TEXT NOT NULL,
    "salesAgentUserId" TEXT NOT NULL,
    "salesAgentReferralId" TEXT NOT NULL,
    "sourceTenantLicenseId" TEXT NOT NULL,
    "paymentSource" TEXT NOT NULL,
    "paymentSourceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "amountPaidUsd" DECIMAL(12,2) NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL,
    "commissionAmountUsd" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesAgentCommissionLedger_pkey" PRIMARY KEY ("salesAgentCommissionLedgerId"),
    CONSTRAINT "SalesAgentCommissionLedger_positive_amounts_check"
      CHECK (
        "amountPaidUsd" > 0
        AND "commissionRate" > 0
        AND "commissionRate" <= 0.07
        AND "commissionAmountUsd" > 0
      )
);

-- CreateTable
CREATE TABLE "SalesAgentBalance" (
    "salesAgentBalanceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availableUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesAgentBalance_pkey" PRIMARY KEY ("salesAgentBalanceId"),
    CONSTRAINT "SalesAgentBalance_non_negative_check"
      CHECK ("availableUsd" >= 0 AND "paidUsd" >= 0)
);

-- CreateTable
CREATE TABLE "SalesAgentPayout" (
    "salesAgentPayoutId" TEXT NOT NULL,
    "salesAgentUserId" TEXT NOT NULL,
    "amountUsd" DECIMAL(12,2) NOT NULL,
    "exchangeRateCupPerUsd" DECIMAL(12,4) NOT NULL,
    "amountCup" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedAt" TIMESTAMP(3),
    "processedByAdminId" TEXT,
    "adminNotes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "immutableFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesAgentPayout_pkey" PRIMARY KEY ("salesAgentPayoutId"),
    CONSTRAINT "SalesAgentPayout_positive_snapshot_check"
      CHECK ("amountUsd" > 0 AND "exchangeRateCupPerUsd" > 0 AND "amountCup" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesAgentProfile_userId_key" ON "SalesAgentProfile"("userId");
CREATE UNIQUE INDEX "SalesAgentProfile_referralCode_key" ON "SalesAgentProfile"("referralCode");
CREATE INDEX "SalesAgentProfile_status_idx" ON "SalesAgentProfile"("status");
CREATE INDEX "SalesAgentProfile_approvedByAdminId_idx" ON "SalesAgentProfile"("approvedByAdminId");
CREATE UNIQUE INDEX "SalesAgentReferral_referredTenantId_key" ON "SalesAgentReferral"("referredTenantId");
CREATE INDEX "SalesAgentReferral_salesAgentUserId_status_idx" ON "SalesAgentReferral"("salesAgentUserId", "status");
CREATE UNIQUE INDEX "SalesAgentCommissionLedger_idempotencyKey_key" ON "SalesAgentCommissionLedger"("idempotencyKey");
CREATE UNIQUE INDEX "SalesAgentCommissionLedger_paymentSourceId_key" ON "SalesAgentCommissionLedger"("paymentSourceId");
CREATE UNIQUE INDEX "SalesAgentCommissionLedger_paymentSource_paymentSourceId_key" ON "SalesAgentCommissionLedger"("paymentSource", "paymentSourceId");
CREATE INDEX "SalesAgentCommissionLedger_salesAgentUserId_status_idx" ON "SalesAgentCommissionLedger"("salesAgentUserId", "status");
CREATE INDEX "SalesAgentCommissionLedger_salesAgentReferralId_idx" ON "SalesAgentCommissionLedger"("salesAgentReferralId");
CREATE INDEX "SalesAgentCommissionLedger_sourceTenantLicenseId_idx" ON "SalesAgentCommissionLedger"("sourceTenantLicenseId");
CREATE UNIQUE INDEX "TenantLicensePayment_idempotencyKey_key" ON "TenantLicensePayment"("idempotencyKey");
CREATE UNIQUE INDEX "TenantLicensePayment_tenantLicenseId_paymentKind_paymentCycleEndsAt_key"
  ON "TenantLicensePayment"("tenantLicenseId", "paymentKind", "paymentCycleEndsAt");
CREATE INDEX "TenantLicensePayment_tenantId_confirmedAt_idx" ON "TenantLicensePayment"("tenantId", "confirmedAt");
CREATE INDEX "TenantLicensePayment_tenantLicenseId_idx" ON "TenantLicensePayment"("tenantLicenseId");
CREATE INDEX "TenantLicensePayment_confirmedByAdminId_idx" ON "TenantLicensePayment"("confirmedByAdminId");
CREATE UNIQUE INDEX "SalesAgentBalance_userId_key" ON "SalesAgentBalance"("userId");
CREATE INDEX "SalesAgentPayout_salesAgentUserId_status_idx" ON "SalesAgentPayout"("salesAgentUserId", "status");
CREATE UNIQUE INDEX "SalesAgentPayout_idempotencyKey_key" ON "SalesAgentPayout"("idempotencyKey");
CREATE INDEX "SalesAgentPayout_processedByAdminId_idx" ON "SalesAgentPayout"("processedByAdminId");

-- AddForeignKey
ALTER TABLE "SalesAgentProfile" ADD CONSTRAINT "SalesAgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesAgentProfile" ADD CONSTRAINT "SalesAgentProfile_approvedByAdminId_fkey" FOREIGN KEY ("approvedByAdminId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesAgentReferral" ADD CONSTRAINT "SalesAgentReferral_salesAgentUserId_fkey" FOREIGN KEY ("salesAgentUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesAgentReferral" ADD CONSTRAINT "SalesAgentReferral_referredTenantId_fkey" FOREIGN KEY ("referredTenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantLicensePayment" ADD CONSTRAINT "TenantLicensePayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantLicensePayment" ADD CONSTRAINT "TenantLicensePayment_tenantLicenseId_fkey" FOREIGN KEY ("tenantLicenseId") REFERENCES "tenant_licenses"("tenantLicenseId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantLicensePayment" ADD CONSTRAINT "TenantLicensePayment_confirmedByAdminId_fkey" FOREIGN KEY ("confirmedByAdminId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesAgentCommissionLedger" ADD CONSTRAINT "SalesAgentCommissionLedger_salesAgentUserId_fkey" FOREIGN KEY ("salesAgentUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesAgentCommissionLedger" ADD CONSTRAINT "SalesAgentCommissionLedger_salesAgentReferralId_fkey" FOREIGN KEY ("salesAgentReferralId") REFERENCES "SalesAgentReferral"("salesAgentReferralId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesAgentCommissionLedger" ADD CONSTRAINT "SalesAgentCommissionLedger_sourceTenantLicenseId_fkey" FOREIGN KEY ("sourceTenantLicenseId") REFERENCES "tenant_licenses"("tenantLicenseId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesAgentCommissionLedger" ADD CONSTRAINT "SalesAgentCommissionLedger_paymentSourceId_fkey" FOREIGN KEY ("paymentSourceId") REFERENCES "TenantLicensePayment"("tenantLicensePaymentId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesAgentCommissionLedger" ADD CONSTRAINT "SalesAgentCommissionLedger_payment_source_check" CHECK ("paymentSource" = 'tenant_license_payment');
ALTER TABLE "SalesAgentBalance" ADD CONSTRAINT "SalesAgentBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesAgentPayout" ADD CONSTRAINT "SalesAgentPayout_salesAgentUserId_fkey" FOREIGN KEY ("salesAgentUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesAgentPayout" ADD CONSTRAINT "SalesAgentPayout_processedByAdminId_fkey" FOREIGN KEY ("processedByAdminId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
