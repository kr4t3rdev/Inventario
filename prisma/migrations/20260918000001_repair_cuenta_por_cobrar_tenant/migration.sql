-- Repair tenant ownership for accounts receivable. The table predates the
-- tracked tenant migration, while current DNC and service flows require it.

ALTER TABLE "VentaServicios"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

UPDATE "VentaServicios" AS servicio
SET "tenantId" = venta."tenantId"
FROM "Venta" AS venta
WHERE servicio."tenantId" IS NULL
  AND servicio."ventaId" = venta."ventaId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "VentaServicios"
    WHERE "tenantId" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot scope service sales: one or more rows have no tenant owner';
  END IF;
END $$;

ALTER TABLE "VentaServicios"
  ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "VentaServicios_tenantId_idx"
  ON "VentaServicios" ("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'VentaServicios_tenantId_fkey'
  ) THEN
    ALTER TABLE "VentaServicios"
      ADD CONSTRAINT "VentaServicios_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants" ("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "CuentaPorCobrar"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "tipoCuenta" TEXT;

UPDATE "CuentaPorCobrar" AS cxc
SET "tenantId" = factura."tenantId"
FROM "facturas" AS factura
WHERE cxc."tenantId" IS NULL
  AND cxc."facturaId" = factura."idFactura";

UPDATE "CuentaPorCobrar" AS cxc
SET "tenantId" = servicio."tenantId"
FROM "VentaServicios" AS servicio
WHERE cxc."tenantId" IS NULL
  AND cxc."ventaServicioId" = servicio."ventaServicioId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "CuentaPorCobrar"
    WHERE "tenantId" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot scope accounts receivable: one or more rows have no tenant owner';
  END IF;
END $$;

ALTER TABLE "CuentaPorCobrar"
  ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "CuentaPorCobrar_tenantId_idx"
  ON "CuentaPorCobrar" ("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CuentaPorCobrar_tenantId_fkey'
  ) THEN
    ALTER TABLE "CuentaPorCobrar"
      ADD CONSTRAINT "CuentaPorCobrar_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants" ("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
