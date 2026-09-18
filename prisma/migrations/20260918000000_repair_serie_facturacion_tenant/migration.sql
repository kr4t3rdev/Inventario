-- Repair the tenant scope introduced in the Prisma model for billing series.
-- Existing series are owned by the tenant of their invoices; orphan series
-- must be assigned explicitly instead of receiving an arbitrary tenant.

ALTER TABLE "series_facturacion"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

UPDATE "series_facturacion" AS serie
SET "tenantId" = factura."tenantId"
FROM "facturas" AS factura
WHERE serie."tenantId" IS NULL
  AND factura."serieId" = serie."serieId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "series_facturacion"
    WHERE "tenantId" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot scope billing series: one or more rows have no tenant owner';
  END IF;
END $$;

ALTER TABLE "series_facturacion"
  ALTER COLUMN "tenantId" SET NOT NULL;

DROP INDEX IF EXISTS "series_facturacion_prefijo_key";
CREATE UNIQUE INDEX IF NOT EXISTS "series_facturacion_tenantId_prefijo_key"
  ON "series_facturacion" ("tenantId", "prefijo");
CREATE INDEX IF NOT EXISTS "SerieFacturacion_tenantId_idx"
  ON "series_facturacion" ("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SerieFacturacion_tenantId_fkey'
  ) THEN
    ALTER TABLE "series_facturacion"
      ADD CONSTRAINT "SerieFacturacion_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants" ("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
