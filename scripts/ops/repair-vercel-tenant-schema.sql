BEGIN;

-- This database was created outside Prisma migrations and currently contains
-- one legacy tenant. Abort rather than guessing ownership in a multi-tenant DB.
DO $$
DECLARE
  tenant_count INTEGER;
  tenant_id TEXT;
BEGIN
  SELECT COUNT(*)::INTEGER, MIN("tenantId")
  INTO tenant_count, tenant_id
  FROM "tenants";

  IF tenant_count <> 1 THEN
    RAISE EXCEPTION
      'Legacy Vercel repair requires exactly one tenant; found %', tenant_count;
  END IF;

  CREATE TEMP TABLE "_LegacyVercelTenant" ("tenantId" TEXT NOT NULL) ON COMMIT DROP;
  INSERT INTO "_LegacyVercelTenant" ("tenantId") VALUES (tenant_id);
END $$;

-- CuentaBancaria must already be tenant-safe because TipoPago.account defaults
-- depend on it. Do not invent ownership for accounts in this repair.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'CuentaBancaria'
      AND column_name = 'tenantId'
  ) THEN
    RAISE EXCEPTION 'CuentaBancaria.tenantId is missing; run its controlled repair first';
  END IF;

  IF EXISTS (SELECT 1 FROM "CuentaBancaria" WHERE "tenantId" IS NULL) THEN
    RAISE EXCEPTION 'CuentaBancaria contains rows without tenantId';
  END IF;
END $$;

-- Preserve Unidad primary keys so existing Producto.unidadId references remain
-- valid. The previous cloning/deletion script could cascade-delete products.
ALTER TABLE "Unidad" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "Unidad" unidad
SET "tenantId" = tenant."tenantId"
FROM "_LegacyVercelTenant" tenant
WHERE unidad."tenantId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Unidad" WHERE "tenantId" IS NULL) THEN
    RAISE EXCEPTION 'No se pudo asignar tenantId a todas las Unidad';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"Unidad"'::regclass AND conname = 'Unidad_nombre_key'
  ) THEN
    ALTER TABLE "Unidad" DROP CONSTRAINT "Unidad_nombre_key";
  ELSIF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relkind = 'i' AND relname = 'Unidad_nombre_key'
  ) THEN
    DROP INDEX "Unidad_nombre_key";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"Unidad"'::regclass AND conname = 'Unidad_simbolo_key'
  ) THEN
    ALTER TABLE "Unidad" DROP CONSTRAINT "Unidad_simbolo_key";
  ELSIF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relkind = 'i' AND relname = 'Unidad_simbolo_key'
  ) THEN
    DROP INDEX "Unidad_simbolo_key";
  END IF;
END $$;

ALTER TABLE "Unidad" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Unidad_tenantId_nombre_key"
  ON "Unidad"("tenantId", "nombre");
CREATE UNIQUE INDEX IF NOT EXISTS "Unidad_tenantId_simbolo_key"
  ON "Unidad"("tenantId", "simbolo");
CREATE INDEX IF NOT EXISTS "Unidad_tenantId_idx" ON "Unidad"("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"Unidad"'::regclass
      AND conname = 'Unidad_tenantId_fkey'
  ) THEN
    ALTER TABLE "Unidad"
      ADD CONSTRAINT "Unidad_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Existing products must survive the repair and future units cannot be deleted
-- while products still reference them.
ALTER TABLE "Producto" DROP CONSTRAINT IF EXISTS "Producto_unidadId_fkey";
ALTER TABLE "Producto"
  ADD CONSTRAINT "Producto_unidadId_fkey"
  FOREIGN KEY ("unidadId") REFERENCES "Unidad"("unidadId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- TipoPago was global in the legacy database. With one tenant, assign the
-- existing rows in place; do not clone rows or change reconciliation IDs.
ALTER TABLE "TipoPago" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "TipoPago" tipo_pago
SET "tenantId" = tenant."tenantId"
FROM "_LegacyVercelTenant" tenant
WHERE tipo_pago."tenantId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "TipoPago" WHERE "tenantId" IS NULL) THEN
    RAISE EXCEPTION 'No se pudo asignar tenantId a todos los TipoPago';
  END IF;
END $$;

ALTER TABLE "TipoPago" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "TipoPago_tenantId_idx" ON "TipoPago"("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"TipoPago"'::regclass
      AND conname = 'TipoPago_tenantId_fkey'
  ) THEN
    ALTER TABLE "TipoPago"
      ADD CONSTRAINT "TipoPago_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
