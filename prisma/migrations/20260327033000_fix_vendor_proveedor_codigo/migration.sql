ALTER TABLE "Vendor"
  ADD COLUMN IF NOT EXISTS "proveedorCodigo" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_proveedorCodigo_key"
  ON "Vendor"("proveedorCodigo");
