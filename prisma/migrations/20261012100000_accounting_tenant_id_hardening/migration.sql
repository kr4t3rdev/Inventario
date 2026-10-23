-- Add the tenant boundary required by the accounting Prisma models.
-- Existing tenant ownership is preserved; only NULL values with unanimous,
-- authoritative source rows are backfilled. CierreContable has no such source.
BEGIN;

DO $$
DECLARE
  has_tenant_column BOOLEAN;
  has_services_tenant_column BOOLEAN;
  has_services_vendor_column BOOLEAN;
  has_purchase_tenant_column BOOLEAN;
  has_conflict BOOLEAN;
  services_owner_sources TEXT;
  purchase_tenant_check TEXT;
BEGIN
  -- A cierre has no reliable parent from which tenant ownership can be inferred.
  -- If populated legacy data has not been explicitly mapped, stop before DDL.
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'CierreContable'
      AND column_name = 'tenantId'
  ) INTO has_tenant_column;

  IF NOT has_tenant_column AND EXISTS (SELECT 1 FROM "CierreContable") THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Cannot add CierreContable.tenantId: populated legacy rows need an explicitly reviewed tenant mapping; add and populate tenantId before retrying.';
  END IF;

  IF has_tenant_column THEN
    IF EXISTS (SELECT 1 FROM "CierreContable" WHERE "tenantId" IS NULL) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Cannot require CierreContable.tenantId: NULL rows need an explicitly reviewed tenant mapping before retrying.';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "CierreContable" AS cierre
      LEFT JOIN "tenants" AS tenant ON tenant."tenantId" = cierre."tenantId"
      WHERE tenant."tenantId" IS NULL
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        MESSAGE = 'CierreContable.tenantId contains values without a matching Tenant.';
    END IF;
  END IF;

  -- Payments inherit ownership only from their required payable account.
  IF EXISTS (
    SELECT 1
    FROM "PagoCuentaPorPagar" AS pago
    LEFT JOIN "CuentaPorPagar" AS cuenta
      ON cuenta."cuentaPorPagarId" = pago."cuentaPorPagarId"
    WHERE cuenta."cuentaPorPagarId" IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM "tenants" AS tenant
         WHERE tenant."tenantId" = cuenta."tenantId"
       )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Cannot backfill PagoCuentaPorPagar.tenantId: every payment must have a valid tenant-owned CuentaPorPagar.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'PagoCuentaPorPagar'
      AND column_name = 'tenantId'
  ) INTO has_tenant_column;
  IF has_tenant_column THEN
    EXECUTE $query$
      SELECT EXISTS (
        SELECT 1
        FROM "PagoCuentaPorPagar" AS pago
        JOIN "CuentaPorPagar" AS cuenta
          ON cuenta."cuentaPorPagarId" = pago."cuentaPorPagarId"
        WHERE pago."tenantId" IS NOT NULL
          AND pago."tenantId" <> cuenta."tenantId"
      )
    $query$ INTO has_conflict;
    IF has_conflict THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'PagoCuentaPorPagar.tenantId conflicts with its CuentaPorPagar tenant.';
    END IF;
  END IF;

  -- VentaServicios and the legacy Servicios.vendorId relation are the only
  -- available ownership sources for Services rows in the replayed schema.
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Servicios'
      AND column_name = 'tenantId'
  ) INTO has_services_tenant_column;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Servicios'
      AND column_name = 'vendorId'
  ) INTO has_services_vendor_column;

  services_owner_sources :=
    'SELECT venta_servicio."servicioId", venta_servicio."tenantId" FROM "VentaServicios" AS venta_servicio';

  IF has_services_vendor_column THEN
    services_owner_sources := services_owner_sources ||
      ' UNION ALL SELECT servicio."servicioId", vendor."tenantId" FROM "Servicios" AS servicio LEFT JOIN "Vendor" AS vendor ON vendor."vendorId" = servicio."vendorId" WHERE servicio."vendorId" IS NOT NULL';
  END IF;

  IF has_services_tenant_column THEN
    services_owner_sources :=
      'SELECT servicio."servicioId", servicio."tenantId" FROM "Servicios" AS servicio WHERE servicio."tenantId" IS NOT NULL UNION ALL ' ||
      services_owner_sources;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "VentaServicios" AS venta_servicio
    LEFT JOIN "Servicios" AS servicio
      ON servicio."servicioId" = venta_servicio."servicioId"
    LEFT JOIN "tenants" AS tenant
      ON tenant."tenantId" = venta_servicio."tenantId"
    WHERE servicio."servicioId" IS NULL
       OR tenant."tenantId" IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Cannot backfill Servicios.tenantId: every linked VentaServicios row must resolve to an existing service and Tenant.';
  END IF;

  EXECUTE format($query$
    WITH owners AS (%s),
    owner_summary AS (
      SELECT "servicioId", count(*) AS owner_count,
        count(DISTINCT "tenantId") AS tenant_count
      FROM owners
      GROUP BY "servicioId"
    )
    SELECT
      EXISTS (
        SELECT 1 FROM owners AS owner
        LEFT JOIN "tenants" AS tenant ON tenant."tenantId" = owner."tenantId"
        WHERE owner."tenantId" IS NULL OR tenant."tenantId" IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM owner_summary WHERE tenant_count <> 1
      )
      OR EXISTS (
        SELECT 1 FROM "Servicios" AS servicio
        LEFT JOIN owner_summary AS summary
          ON summary."servicioId" = servicio."servicioId"
        WHERE %s AND (summary.owner_count IS NULL OR summary.tenant_count <> 1)
      )
  $query$,
    services_owner_sources,
    CASE WHEN has_services_tenant_column
      THEN 'servicio."tenantId" IS NULL'
      ELSE 'TRUE'
    END
  ) INTO has_conflict;

  IF has_conflict THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Cannot backfill Servicios.tenantId: Vendor and linked VentaServicios tenant ownership must be valid and unanimous; unowned or conflicting rows need an explicitly reviewed mapping.';
  END IF;

  -- The service tenant is derived only after all of its owners agree. A
  -- CompraServicio vendor is optional, but when present must match that owner.
  IF EXISTS (
    SELECT 1
    FROM "CompraServicio" AS compra
    LEFT JOIN "Servicios" AS servicio ON servicio."servicioId" = compra."servicioId"
    LEFT JOIN "Vendor" AS vendor ON vendor."vendorId" = compra."proveedorId"
    WHERE servicio."servicioId" IS NULL
       OR (compra."proveedorId" IS NOT NULL AND vendor."vendorId" IS NULL)
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Cannot backfill CompraServicio.tenantId: every purchase must reference an existing service and optional vendor.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'CompraServicio'
      AND column_name = 'tenantId'
  ) INTO has_tenant_column;
  has_purchase_tenant_column := has_tenant_column;
  purchase_tenant_check := CASE WHEN has_purchase_tenant_column
    THEN 'OR (compra."tenantId" IS NOT NULL AND compra."tenantId" <> resolved."tenantId")'
    ELSE ''
  END;

  EXECUTE format($query$
    WITH owners AS (%s),
    resolved_services AS (
      SELECT "servicioId", min("tenantId") AS "tenantId"
      FROM owners
      GROUP BY "servicioId"
      HAVING count(DISTINCT "tenantId") = 1
    )
    SELECT EXISTS (
      SELECT 1
      FROM "CompraServicio" AS compra
      JOIN resolved_services AS resolved
        ON resolved."servicioId" = compra."servicioId"
      LEFT JOIN "Vendor" AS vendor ON vendor."vendorId" = compra."proveedorId"
      WHERE (compra."proveedorId" IS NOT NULL
          AND vendor."tenantId" IS DISTINCT FROM resolved."tenantId")
        %s
    )
  $query$, services_owner_sources, purchase_tenant_check) INTO has_conflict;

  IF has_conflict THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'CompraServicio ownership conflicts with its service lineage or optional vendor tenant.';
  END IF;

  -- GastoCompra requires consensus between both ownership-bearing relations.
  IF EXISTS (
    SELECT 1
    FROM "GastoCompra" AS gasto
    LEFT JOIN "Producto" AS producto ON producto."id" = gasto."productoId"
    LEFT JOIN "Vendor" AS vendor ON vendor."vendorId" = gasto."vendorId"
    WHERE producto."id" IS NULL
       OR vendor."vendorId" IS NULL
       OR producto."tenantId" <> vendor."tenantId"
       OR NOT EXISTS (
         SELECT 1 FROM "tenants" AS tenant
         WHERE tenant."tenantId" = producto."tenantId"
       )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Cannot backfill GastoCompra.tenantId: Producto and Vendor must resolve to the same valid Tenant.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'GastoCompra'
      AND column_name = 'tenantId'
  ) INTO has_tenant_column;
  IF has_tenant_column THEN
    EXECUTE $query$
      SELECT EXISTS (
        SELECT 1
        FROM "GastoCompra" AS gasto
        JOIN "Producto" AS producto ON producto."id" = gasto."productoId"
        JOIN "Vendor" AS vendor ON vendor."vendorId" = gasto."vendorId"
        WHERE gasto."tenantId" IS NOT NULL
          AND (gasto."tenantId" <> producto."tenantId"
            OR gasto."tenantId" <> vendor."tenantId")
      )
    $query$ INTO has_conflict;
    IF has_conflict THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'GastoCompra.tenantId conflicts with its Producto or Vendor tenant.';
    END IF;
  END IF;
END $$;

ALTER TABLE "CierreContable"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Servicios"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "PagoCuentaPorPagar"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "CompraServicio"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "GastoCompra"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

DO $$
DECLARE
  has_services_vendor_column BOOLEAN;
  owner_sources TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Servicios'
      AND column_name = 'vendorId'
  ) INTO has_services_vendor_column;

  owner_sources :=
    'SELECT venta_servicio."servicioId", venta_servicio."tenantId" FROM "VentaServicios" AS venta_servicio';
  IF has_services_vendor_column THEN
    owner_sources := owner_sources ||
      ' UNION ALL SELECT servicio."servicioId", vendor."tenantId" FROM "Servicios" AS servicio LEFT JOIN "Vendor" AS vendor ON vendor."vendorId" = servicio."vendorId" WHERE servicio."vendorId" IS NOT NULL';
  END IF;

  EXECUTE format($statement$
    WITH owners AS (%s),
    resolved_services AS (
      SELECT "servicioId", min("tenantId") AS "tenantId"
      FROM owners
      GROUP BY "servicioId"
      HAVING count(DISTINCT "tenantId") = 1
    )
    UPDATE "Servicios" AS servicio
    SET "tenantId" = resolved."tenantId"
    FROM resolved_services AS resolved
    WHERE servicio."tenantId" IS NULL
      AND servicio."servicioId" = resolved."servicioId"
  $statement$, owner_sources);
END $$;

UPDATE "PagoCuentaPorPagar" AS pago
SET "tenantId" = cuenta."tenantId"
FROM "CuentaPorPagar" AS cuenta
WHERE pago."tenantId" IS NULL
  AND cuenta."cuentaPorPagarId" = pago."cuentaPorPagarId";

UPDATE "CompraServicio" AS compra
SET "tenantId" = servicio."tenantId"
FROM "Servicios" AS servicio
WHERE compra."tenantId" IS NULL
  AND servicio."servicioId" = compra."servicioId";

UPDATE "GastoCompra" AS gasto
SET "tenantId" = producto."tenantId"
FROM "Producto" AS producto, "Vendor" AS vendor
WHERE gasto."tenantId" IS NULL
  AND producto."id" = gasto."productoId"
  AND vendor."vendorId" = gasto."vendorId"
  AND producto."tenantId" = vendor."tenantId";

ALTER TABLE "CierreContable" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Servicios" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "PagoCuentaPorPagar" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CompraServicio" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "GastoCompra" ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "CierreContable_tenantId_idx"
  ON "CierreContable" ("tenantId");
CREATE INDEX IF NOT EXISTS "Servicios_tenantId_idx"
  ON "Servicios" ("tenantId");
CREATE INDEX IF NOT EXISTS "PagoCuentaPorPagar_tenantId_idx"
  ON "PagoCuentaPorPagar" ("tenantId");
CREATE INDEX IF NOT EXISTS "CompraServicio_tenantId_idx"
  ON "CompraServicio" ("tenantId");
CREATE INDEX IF NOT EXISTS "GastoCompra_tenantId_idx"
  ON "GastoCompra" ("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CierreContable_tenantId_fkey'
      AND conrelid = '"CierreContable"'::regclass
  ) THEN
    ALTER TABLE "CierreContable"
      ADD CONSTRAINT "CierreContable_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants" ("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PagoCuentaPorPagar_tenantId_fkey'
      AND conrelid = '"PagoCuentaPorPagar"'::regclass
  ) THEN
    ALTER TABLE "PagoCuentaPorPagar"
      ADD CONSTRAINT "PagoCuentaPorPagar_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants" ("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

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

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CompraServicio_tenantId_fkey'
      AND conrelid = '"CompraServicio"'::regclass
  ) THEN
    ALTER TABLE "CompraServicio"
      ADD CONSTRAINT "CompraServicio_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants" ("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'GastoCompra_tenantId_fkey'
      AND conrelid = '"GastoCompra"'::regclass
  ) THEN
    ALTER TABLE "GastoCompra"
      ADD CONSTRAINT "GastoCompra_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants" ("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
