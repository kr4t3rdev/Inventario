-- Forward-only nullable expansion. Existing tenant data is never replaced.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "ListaPrecio" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = '"ListaPrecio"'::regclass AND attname = 'tenantId'
      AND atttypid = 'text'::regtype AND NOT attisdropped
      AND NOT atthasdef AND attgenerated = ''
  ) THEN
    RAISE EXCEPTION 'Incompatible ListaPrecio.tenantId: expected TEXT without default or generation';
  END IF;
END $$;
COMMIT;
