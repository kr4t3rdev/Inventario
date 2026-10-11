-- Immutable receipt for keyed license-renewal operations: replays return the
-- original committed outcome instead of extending the license again.
CREATE TABLE "license_renewal_operations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "payloadFingerprint" TEXT NOT NULL,
    "tenantLicenseId" TEXT,
    "responseSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_renewal_operations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "license_renewal_operations_tenantId_keyHash_key"
    ON "license_renewal_operations"("tenantId", "keyHash");
CREATE INDEX "license_renewal_operations_tenantId_createdAt_idx"
    ON "license_renewal_operations"("tenantId", "createdAt");

ALTER TABLE "license_renewal_operations"
    ADD CONSTRAINT "license_renewal_operations_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "license_renewal_operations"
    ADD CONSTRAINT "license_renewal_operations_tenantLicenseId_fkey"
    FOREIGN KEY ("tenantLicenseId") REFERENCES "tenant_licenses"("tenantLicenseId")
    ON DELETE SET NULL ON UPDATE CASCADE;
