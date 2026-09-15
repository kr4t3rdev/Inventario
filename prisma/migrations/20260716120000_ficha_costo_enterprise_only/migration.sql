-- Restrict Ficha de Costo to Empresarial/Enterprise plans and legacy licenses.
-- The Prisma schema renamed Plan.funcionalidades to Plan.features without a
-- corresponding migration. Restore the target column before using it and
-- preserve legacy JSON values when the old column is still present.
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

UPDATE "Plan"
SET "features" = CASE
  WHEN lower("nombre") IN ('empresarial', 'enterprise') THEN
    (CASE WHEN jsonb_typeof("features") = 'object' THEN "features" ELSE '{}'::jsonb END)
      || '{"ficha-costo": true, "ficha-costo-bulk": true}'::jsonb
  WHEN lower("nombre") IN ('básico', 'basico', 'profesional') THEN
    (CASE WHEN jsonb_typeof("features") = 'object' THEN "features" ELSE '{}'::jsonb END)
      || '{"ficha-costo": false, "ficha-costo-bulk": false}'::jsonb
  ELSE "features"
END
WHERE lower("nombre") IN ('básico', 'basico', 'profesional', 'empresarial', 'enterprise');

WITH license_plans AS (
  SELECT license."tenantLicenseId", plan."nombre" AS "planNombre"
  FROM "tenant_licenses" AS license
  LEFT JOIN "Plan" AS plan ON plan."planId" = license."planId"
)
UPDATE "tenant_licenses" AS license
SET
  "features" = CASE
    WHEN lower(COALESCE(license_plans."planNombre", '')) IN ('empresarial', 'enterprise') THEN
      (CASE WHEN jsonb_typeof(license."features") = 'object' THEN license."features" ELSE '{}'::jsonb END)
        || '{"ficha-costo": true, "ficha-costo-bulk": true}'::jsonb
    ELSE
      (CASE WHEN jsonb_typeof(license."features") = 'object' THEN license."features" ELSE '{}'::jsonb END)
        || '{"ficha-costo": false, "ficha-costo-bulk": false}'::jsonb
  END,
  "featureOverrides" =
    (CASE WHEN jsonb_typeof(license."featureOverrides") = 'object' THEN license."featureOverrides" ELSE '{}'::jsonb END)
      - 'ficha-costo' - 'ficha-costo-bulk'
FROM license_plans
WHERE license."tenantLicenseId" = license_plans."tenantLicenseId";
