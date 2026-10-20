-- Contract after successful preflight/backfill. No destructive DOWN: roll forward.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE "ListaPrecio" ALTER COLUMN "tenantId" SET NOT NULL;
DO $$
DECLARE
  owner_column SMALLINT;
  target_column SMALLINT;
BEGIN
  SELECT attnum INTO owner_column FROM pg_attribute
    WHERE attrelid = '"ListaPrecio"'::regclass AND attname = 'tenantId';
  SELECT attnum INTO target_column FROM pg_attribute
    WHERE attrelid = '"tenants"'::regclass AND attname = 'tenantId';
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"ListaPrecio"'::regclass AND conname = 'ListaPrecio_tenantId_fkey'
      AND NOT (contype = 'f' AND conkey = ARRAY[owner_column]
        AND confrelid = '"tenants"'::regclass AND confkey = ARRAY[target_column]
        AND confdeltype = 'r' AND confupdtype = 'c'
        AND convalidated AND NOT condeferrable)
  ) THEN
    RAISE EXCEPTION 'Incompatible ListaPrecio_tenantId_fkey: expected validated tenant FK RESTRICT/CASCADE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = '"ListaPrecio"'::regclass AND conname = 'ListaPrecio_tenantId_fkey') THEN
    ALTER TABLE "ListaPrecio" ADD CONSTRAINT "ListaPrecio_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants" ("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF to_regclass('"ListaPrecio_tenantId_idx"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_index index JOIN pg_class object ON object.oid = index.indexrelid
    JOIN pg_am method ON method.oid = object.relam
    WHERE index.indexrelid = to_regclass('"ListaPrecio_tenantId_idx"')
      AND index.indrelid = '"ListaPrecio"'::regclass
      AND index.indisvalid AND index.indisready AND NOT index.indisunique
      AND index.indnkeyatts = 1 AND index.indnatts = 1
      AND index.indkey[0] = owner_column AND index.indpred IS NULL
      AND index.indexprs IS NULL AND method.amname = 'btree'
  ) THEN
    RAISE EXCEPTION 'Incompatible ListaPrecio_tenantId_idx: expected valid plain tenant btree index';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "ListaPrecio_tenantId_idx" ON "ListaPrecio" ("tenantId");
COMMIT;
