-- La FK compuesta conserva el vínculo período + tenant y sustituye la FK simple.
-- No retirar protección si las definiciones actuales difieren del estado ensayado.
BEGIN;

DO $$
DECLARE
  opening_oid OID := '"apertura_periodos"'::regclass;
  period_oid OID := '"periodos_contables"'::regclass;
  opening_tenant SMALLINT;
  opening_period SMALLINT;
  period_tenant SMALLINT;
  period_id SMALLINT;
BEGIN
  SELECT attnum INTO opening_tenant FROM pg_attribute
    WHERE attrelid = opening_oid AND attname = 'tenantId' AND NOT attisdropped;
  SELECT attnum INTO opening_period FROM pg_attribute
    WHERE attrelid = opening_oid AND attname = 'periodoId' AND NOT attisdropped;
  SELECT attnum INTO period_tenant FROM pg_attribute
    WHERE attrelid = period_oid AND attname = 'tenantId' AND NOT attisdropped;
  SELECT attnum INTO period_id FROM pg_attribute
    WHERE attrelid = period_oid AND attname = 'periodoId' AND NOT attisdropped;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = opening_oid
      AND c.conname = 'apertura_periodos_periodoId_tenantId_fkey'
      AND c.contype = 'f' AND c.convalidated AND c.confrelid = period_oid
      AND c.conkey = ARRAY[opening_tenant, opening_period]::SMALLINT[]
      AND c.confkey = ARRAY[period_tenant, period_id]::SMALLINT[]
      AND c.confdeltype = 'c' AND c.confupdtype = 'c'
  ) THEN
    RAISE EXCEPTION 'OPENING_COMPOSITE_FK_NOT_VERIFIED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = opening_oid AND c.conname = 'apertura_periodos_periodoId_fkey'
      AND NOT (
        c.contype = 'f' AND c.convalidated AND c.confrelid = period_oid
        AND c.conkey = ARRAY[opening_period]::SMALLINT[]
        AND c.confkey = ARRAY[period_id]::SMALLINT[]
        AND c.confdeltype = 'c' AND c.confupdtype = 'c'
      )
  ) THEN
    RAISE EXCEPTION 'OPENING_LEGACY_FK_NOT_VERIFIED';
  END IF;
END $$;

ALTER TABLE "apertura_periodos" DROP CONSTRAINT IF EXISTS "apertura_periodos_periodoId_fkey";

COMMIT;
