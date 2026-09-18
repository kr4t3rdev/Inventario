DROP INDEX IF EXISTS "TenantLicensePayment_tenantLicenseId_paymentKind_paymentCycleEndsAt_key";

CREATE UNIQUE INDEX "TenantLicensePayment_tenantLicenseId_paymentCycleEndsAt_key"
  ON "TenantLicensePayment"("tenantLicenseId", "paymentCycleEndsAt");
