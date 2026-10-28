-- Ownership requires a valid service and agreement with any linked vendor.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE "tenants", "Servicios", "Vendor", "CompraServicio" IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE "CompraServicio" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "CompraServicio" purchase
    LEFT JOIN "Servicios" service ON service."servicioId" = purchase."servicioId"
    LEFT JOIN "tenants" owner ON owner."tenantId" = service."tenantId"
    LEFT JOIN "Vendor" vendor ON vendor."vendorId" = purchase."proveedorId"
    WHERE service."servicioId" IS NULL OR owner."tenantId" IS NULL
      OR (purchase."tenantId" IS NOT NULL AND purchase."tenantId" IS DISTINCT FROM service."tenantId")
      OR (purchase."proveedorId" IS NOT NULL AND
        (vendor."vendorId" IS NULL OR vendor."tenantId" IS DISTINCT FROM service."tenantId"))
  ) THEN
    RAISE EXCEPTION 'CompraServicio: missing or conflicting ownership; review historical records';
  END IF;
END $$;

UPDATE "CompraServicio" purchase SET "tenantId" = service."tenantId"
FROM "Servicios" service
WHERE purchase."servicioId" = service."servicioId" AND purchase."tenantId" IS NULL;
ALTER TABLE "CompraServicio" ALTER COLUMN "tenantId" SET NOT NULL;

DO $$
DECLARE owner_column SMALLINT; target_column SMALLINT;
BEGIN
  SELECT attnum INTO owner_column FROM pg_attribute
    WHERE attrelid = '"CompraServicio"'::regclass AND attname = 'tenantId';
  SELECT attnum INTO target_column FROM pg_attribute
    WHERE attrelid = '"tenants"'::regclass AND attname = 'tenantId';
  IF EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = '"CompraServicio"'::regclass AND conname = 'CompraServicio_tenantId_fkey'
      AND NOT (contype = 'f' AND conkey = ARRAY[owner_column]
        AND confrelid = '"tenants"'::regclass AND confkey = ARRAY[target_column]
        AND confdeltype = 'r' AND confupdtype = 'c' AND convalidated AND NOT condeferrable)) THEN
    RAISE EXCEPTION 'CompraServicio: incompatible tenant foreign key';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = '"CompraServicio"'::regclass AND conname = 'CompraServicio_tenantId_fkey') THEN
    ALTER TABLE "CompraServicio" ADD CONSTRAINT "CompraServicio_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants" ("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF to_regclass('"CompraServicio_tenantId_idx"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_am m ON m.oid = c.relam
    WHERE i.indexrelid = to_regclass('"CompraServicio_tenantId_idx"')
      AND i.indrelid = '"CompraServicio"'::regclass AND i.indisvalid AND i.indisready
      AND NOT i.indisunique AND i.indnkeyatts = 1 AND i.indnatts = 1
      AND i.indkey[0] = owner_column AND i.indpred IS NULL AND i.indexprs IS NULL AND m.amname = 'btree'
  ) THEN
    RAISE EXCEPTION 'CompraServicio: incompatible tenant index';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "CompraServicio_tenantId_idx" ON "CompraServicio" ("tenantId");
COMMIT;
