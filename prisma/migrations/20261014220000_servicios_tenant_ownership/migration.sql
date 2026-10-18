-- Resolve only Servicios ownership from existing tenant, Vendor, and sale lineage.
-- This intentionally does not guess an owner when no unanimous source exists.
BEGIN;

DO $$
DECLARE
  has_vendor_column BOOLEAN;
  has_tenant_column BOOLEAN;
  owner_sources TEXT;
  has_conflict BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Servicios' AND column_name = 'tenantId'
  ) INTO has_tenant_column;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Servicios' AND column_name = 'vendorId'
  ) INTO has_vendor_column;

  owner_sources :=
    'SELECT venta."servicioId", venta."tenantId" FROM "VentaServicios" AS venta';
  IF has_vendor_column THEN
    owner_sources := owner_sources ||
      ' UNION ALL SELECT servicio."servicioId", vendor."tenantId" FROM "Servicios" AS servicio LEFT JOIN "Vendor" AS vendor ON vendor."vendorId" = servicio."vendorId" WHERE servicio."vendorId" IS NOT NULL';
  END IF;
  IF has_tenant_column THEN
    owner_sources :=
      'SELECT servicio."servicioId", servicio."tenantId" FROM "Servicios" AS servicio WHERE servicio."tenantId" IS NOT NULL UNION ALL ' ||
      owner_sources;
  END IF;

  IF EXISTS (
    SELECT 1 FROM "VentaServicios" AS venta
    LEFT JOIN "Servicios" AS servicio ON servicio."servicioId" = venta."servicioId"
    LEFT JOIN "tenants" AS tenant ON tenant."tenantId" = venta."tenantId"
    WHERE servicio."servicioId" IS NULL OR tenant."tenantId" IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Cannot backfill Servicios.tenantId: every linked VentaServicios row must resolve to an existing service and Tenant.';
  END IF;

  EXECUTE format($query$
    WITH owners AS (%s),
    owner_summary AS (
      SELECT "servicioId", count(DISTINCT "tenantId") AS tenant_count
      FROM owners GROUP BY "servicioId"
    )
    SELECT
      EXISTS (
        SELECT 1 FROM owners AS owner
        LEFT JOIN "tenants" AS tenant ON tenant."tenantId" = owner."tenantId"
        WHERE owner."tenantId" IS NULL OR tenant."tenantId" IS NULL
      )
      OR EXISTS (SELECT 1 FROM owner_summary WHERE tenant_count <> 1)
      OR EXISTS (
        SELECT 1 FROM "Servicios" AS servicio
        LEFT JOIN owner_summary AS summary ON summary."servicioId" = servicio."servicioId"
        WHERE %s AND (summary."servicioId" IS NULL OR summary.tenant_count <> 1)
      )
  $query$,
    owner_sources,
    CASE WHEN has_tenant_column THEN 'servicio."tenantId" IS NULL' ELSE 'TRUE' END
  ) INTO has_conflict;

  IF has_conflict THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Cannot backfill Servicios.tenantId: Vendor and linked VentaServicios ownership must be valid and unanimous; unowned or conflicting rows need an explicitly reviewed mapping.';
  END IF;
END $$;

ALTER TABLE "Servicios" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

DO $$
DECLARE
  has_vendor_column BOOLEAN;
  owner_sources TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Servicios' AND column_name = 'vendorId'
  ) INTO has_vendor_column;

  owner_sources :=
    'SELECT venta."servicioId", venta."tenantId" FROM "VentaServicios" AS venta';
  IF has_vendor_column THEN
    owner_sources := owner_sources ||
      ' UNION ALL SELECT servicio."servicioId", vendor."tenantId" FROM "Servicios" AS servicio LEFT JOIN "Vendor" AS vendor ON vendor."vendorId" = servicio."vendorId" WHERE servicio."vendorId" IS NOT NULL';
  END IF;

  EXECUTE format($query$
    WITH owners AS (%s),
    resolved AS (
      SELECT "servicioId", min("tenantId") AS "tenantId"
      FROM owners GROUP BY "servicioId"
      HAVING count(DISTINCT "tenantId") = 1
    )
    UPDATE "Servicios" AS servicio SET "tenantId" = resolved."tenantId"
    FROM resolved
    WHERE servicio."tenantId" IS NULL AND servicio."servicioId" = resolved."servicioId"
  $query$, owner_sources);
END $$;

ALTER TABLE "Servicios" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "Servicios_tenantId_idx" ON "Servicios" ("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Servicios_tenantId_fkey'
      AND conrelid = '"Servicios"'::regclass
  ) THEN
    ALTER TABLE "Servicios"
      ADD CONSTRAINT "Servicios_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants" ("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
