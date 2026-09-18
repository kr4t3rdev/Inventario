-- Repair migration for databases that recorded
-- 20260716120000_ficha_costo_enterprise_only before Plan.features existed.
ALTER TABLE "Plan"
  ADD COLUMN IF NOT EXISTS "features" JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Plan'
      AND column_name = 'funcionalidades'
  ) THEN
    EXECUTE 'UPDATE "Plan" SET "features" = "funcionalidades" WHERE "features" = ''{}''::jsonb AND "funcionalidades" IS NOT NULL';
  END IF;
END $$;
