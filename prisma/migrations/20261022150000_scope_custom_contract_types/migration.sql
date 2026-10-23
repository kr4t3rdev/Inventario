BEGIN;
-- Fail quickly rather than hold application traffic behind a schema lock.
SET LOCAL lock_timeout = '5s';

-- Existing rows remain NULL: the global creator identity is not a safe tenant attribution.
ALTER TABLE "TipoContratoCustom"
  ADD COLUMN "tenantId" TEXT;

ALTER TABLE "TipoContratoCustom"
  ADD CONSTRAINT "TipoContratoCustom_tenantId_fkey"
  FOREIGN KEY ("tenantId")
  REFERENCES "tenants"("tenantId")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "TipoContratoCustom_tenantId_idx"
  ON "TipoContratoCustom"("tenantId");

CREATE UNIQUE INDEX "TipoContratoCustom_tenantId_nombre_key"
  ON "TipoContratoCustom"("tenantId", "nombre");

DO $$
DECLARE
  nombre_column smallint;
BEGIN
  SELECT attnum INTO nombre_column
  FROM pg_attribute
  WHERE attrelid = '"TipoContratoCustom"'::regclass
    AND attname = 'nombre'
    AND NOT attisdropped;

  IF nombre_column IS NULL THEN
    RAISE EXCEPTION 'TipoContratoCustom.nombre is missing; refusing to change uniqueness';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.contype = 'f'
      AND constraint_row.confrelid = '"TipoContratoCustom"'::regclass
      AND nombre_column = ANY(constraint_row.confkey)
  ) THEN
    RAISE EXCEPTION 'TipoContratoCustom.nombre is referenced by a foreign key; refusing to drop global uniqueness';
  END IF;
END $$;

-- Tenant uniqueness is live before dropping global uniqueness; the preflight above
-- refuses this change if a foreign key depends on the legacy nombre key.
DROP INDEX "TipoContratoCustom_nombre_key";

COMMIT;
