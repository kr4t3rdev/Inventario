-- Repair migration for databases that recorded
-- 20260722120000_add_tenant_id_tipo_pago before CuentaBancaria.tenantId was
-- restored in migration history.
ALTER TABLE "CuentaBancaria" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

DO $$
BEGIN
  UPDATE "CuentaBancaria" account
  SET "tenantId" = owners."ownerTenantId"
  FROM (
    SELECT references_by_tenant."cuentaId",
      MIN(references_by_tenant."tenantId") AS "ownerTenantId"
    FROM (
      SELECT me."cuentaBancariaId" AS "cuentaId", me."tenantId"
      FROM "MiEmpresa" me
      WHERE me."cuentaBancariaId" IS NOT NULL AND me."tenantId" IS NOT NULL
    ) references_by_tenant
    GROUP BY references_by_tenant."cuentaId"
    HAVING COUNT(DISTINCT references_by_tenant."tenantId") = 1
  ) owners
  WHERE account."cuentaId" = owners."cuentaId"
    AND account."tenantId" IS NULL;

  IF EXISTS (SELECT 1 FROM "CuentaBancaria" WHERE "tenantId" IS NULL) THEN
    RAISE EXCEPTION 'No se pudo asignar tenantId a todas las CuentaBancaria';
  END IF;
END $$;

ALTER TABLE "ReconciliacionVenta" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "ReconciliacionServicio" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "ReconciliacionGasto" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

UPDATE "ReconciliacionVenta" reconciliation
SET "tenantId" = account."tenantId"
FROM "CuentaBancaria" account
WHERE reconciliation."cuentaId" = account."cuentaId"
  AND reconciliation."tenantId" IS NULL;
UPDATE "ReconciliacionServicio" reconciliation
SET "tenantId" = account."tenantId"
FROM "CuentaBancaria" account
WHERE reconciliation."cuentaId" = account."cuentaId"
  AND reconciliation."tenantId" IS NULL;
UPDATE "ReconciliacionGasto" reconciliation
SET "tenantId" = account."tenantId"
FROM "CuentaBancaria" account
WHERE reconciliation."cuentaId" = account."cuentaId"
  AND reconciliation."tenantId" IS NULL;

ALTER TABLE "ReconciliacionVenta" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ReconciliacionServicio" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ReconciliacionGasto" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ReconciliacionVenta_tenantId_idx" ON "ReconciliacionVenta"("tenantId");
CREATE INDEX IF NOT EXISTS "ReconciliacionServicio_tenantId_idx" ON "ReconciliacionServicio"("tenantId");
CREATE INDEX IF NOT EXISTS "ReconciliacionGasto_tenantId_idx" ON "ReconciliacionGasto"("tenantId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReconciliacionVenta_tenantId_fkey') THEN
    ALTER TABLE "ReconciliacionVenta" ADD CONSTRAINT "ReconciliacionVenta_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReconciliacionServicio_tenantId_fkey') THEN
    ALTER TABLE "ReconciliacionServicio" ADD CONSTRAINT "ReconciliacionServicio_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReconciliacionGasto_tenantId_fkey') THEN
    ALTER TABLE "ReconciliacionGasto" ADD CONSTRAINT "ReconciliacionGasto_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
ALTER TABLE "CuentaBancaria" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "CuentaBancaria_tenantId_idx" ON "CuentaBancaria"("tenantId");
DROP INDEX IF EXISTS "CuentaBancaria_numeroCuenta_key";
CREATE UNIQUE INDEX IF NOT EXISTS "CuentaBancaria_tenantId_numeroCuenta_key"
  ON "CuentaBancaria"("tenantId", "numeroCuenta");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CuentaBancaria_tenantId_fkey'
      AND conrelid = '"CuentaBancaria"'::regclass
  ) THEN
    ALTER TABLE "CuentaBancaria"
      ADD CONSTRAINT "CuentaBancaria_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
