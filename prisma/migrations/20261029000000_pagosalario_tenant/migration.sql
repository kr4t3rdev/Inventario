-- Derive ownership only from the employee; ambiguous historical rows block the migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE "tenants", "Empleado", "Pagosalario" IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE "Pagosalario" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Pagosalario" p
    LEFT JOIN "Empleado" e ON e."empleadoId" = p."empleadoId"
    LEFT JOIN "tenants" t ON t."tenantId" = e."tenantId"
    WHERE e."empleadoId" IS NULL OR t."tenantId" IS NULL
       OR (p."tenantId" IS NOT NULL AND p."tenantId" IS DISTINCT FROM e."tenantId")
  ) THEN
    RAISE EXCEPTION 'Pagosalario: missing or conflicting employee ownership; review historical records';
  END IF;
END $$;

UPDATE "Pagosalario" p SET "tenantId" = e."tenantId"
FROM "Empleado" e
WHERE p."empleadoId" = e."empleadoId" AND p."tenantId" IS NULL;

ALTER TABLE "Pagosalario" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$
DECLARE
  owner_column SMALLINT;
  target_column SMALLINT;
BEGIN
  SELECT attnum INTO owner_column FROM pg_attribute
    WHERE attrelid = '"Pagosalario"'::regclass AND attname = 'tenantId';
  SELECT attnum INTO target_column FROM pg_attribute
    WHERE attrelid = '"tenants"'::regclass AND attname = 'tenantId';
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"Pagosalario"'::regclass AND conname = 'Pagosalario_tenantId_fkey'
      AND NOT (contype = 'f' AND conkey = ARRAY[owner_column]
        AND confrelid = '"tenants"'::regclass AND confkey = ARRAY[target_column]
        AND confdeltype = 'r' AND confupdtype = 'c' AND convalidated AND NOT condeferrable)
  ) THEN
    RAISE EXCEPTION 'Pagosalario: incompatible tenant foreign key';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = '"Pagosalario"'::regclass AND conname = 'Pagosalario_tenantId_fkey') THEN
    ALTER TABLE "Pagosalario" ADD CONSTRAINT "Pagosalario_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants" ("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF to_regclass('"Pagosalario_tenantId_idx"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_am method ON method.oid = c.relam
    WHERE i.indexrelid = to_regclass('"Pagosalario_tenantId_idx"')
      AND i.indrelid = '"Pagosalario"'::regclass AND i.indisvalid AND i.indisready
      AND NOT i.indisunique AND i.indnkeyatts = 1 AND i.indnatts = 1
      AND i.indkey[0] = owner_column AND i.indpred IS NULL AND i.indexprs IS NULL
      AND method.amname = 'btree'
  ) THEN
    RAISE EXCEPTION 'Pagosalario: incompatible tenant index';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "Pagosalario_tenantId_idx" ON "Pagosalario" ("tenantId");
COMMIT;
