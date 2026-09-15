-- Restore the legacy Vendor code expected by the tenant-scoping migration.
-- Keep the column nullable so existing rows can be migrated without a table rewrite.
ALTER TABLE "Vendor"
  ADD COLUMN IF NOT EXISTS "vendorCode" TEXT;

-- Preserve an existing provider code when one is available; rows without one stay NULL.
UPDATE "Vendor"
SET "vendorCode" = "proveedorCodigo"
WHERE "vendorCode" IS NULL
  AND "proveedorCodigo" IS NOT NULL;

-- The following tenant migration replaces this global key with a tenant-scoped key.
CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_vendorCode_key"
  ON "Vendor"("vendorCode");
