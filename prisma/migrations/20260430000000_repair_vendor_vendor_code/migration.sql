-- Restore the legacy Vendor code expected by the tenant-scoping migration.
-- Keep the column nullable so existing rows can be migrated without a table rewrite.
ALTER TABLE "Vendor"
  ADD COLUMN IF NOT EXISTS "vendorCode" TEXT;

-- Preserve an existing provider code when one is available; rows without one stay NULL.
-- The legacy column may be absent when this repair is replayed after its migration
-- history was already marked applied, so inspect the catalog before referencing it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Vendor'
      AND column_name = 'proveedorCodigo'
  ) THEN
    EXECUTE 'UPDATE "Vendor"
      SET "vendorCode" = "proveedorCodigo"
      WHERE "vendorCode" IS NULL
        AND "proveedorCodigo" IS NOT NULL';
  END IF;
END
$$;

-- The following tenant migration replaces this global key with a tenant-scoped key.
-- Do not reintroduce the superseded global index when the tenant-scoped index
-- already exists in a partially advanced database.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'Vendor'
      AND indexname = 'Vendor_tenantId_vendorCode_key'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_vendorCode_key"
      ON "Vendor"("vendorCode");
  END IF;
END
$$;
