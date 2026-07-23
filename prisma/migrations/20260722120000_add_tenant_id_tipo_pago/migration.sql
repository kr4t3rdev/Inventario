BEGIN;

-- Add tenantId to TipoPago (nullable initially for backfill)
ALTER TABLE "TipoPago" ADD COLUMN "tenantId" TEXT;

-- Add index on tenantId for performance
CREATE INDEX "TipoPago_tenantId_idx" ON "TipoPago"("tenantId");

-- Add foreign key constraint
ALTER TABLE "TipoPago" ADD CONSTRAINT "TipoPago_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the previously-global configuration for every existing tenant.
-- The mapping is created before inserting clones so only pre-migration rows are considered.
CREATE TEMP TABLE "_TipoPagoTenantMap" AS
SELECT
  tp."tipoId" AS "sourceTipoId",
  tp."nombre" AS "sourceNombre",
  tp."descripcion" AS "sourceDescripcion",
  tp."requiereCuenta" AS "sourceRequiereCuenta",
  tp."cuentaDefecto" AS "sourceCuentaDefecto",
  tp."isActive" AS "sourceIsActive",
  tp."createdAt" AS "sourceCreatedAt",
  tp."updatedAt" AS "sourceUpdatedAt",
  tenant."tenantId",
  CASE
    WHEN ROW_NUMBER() OVER (
      PARTITION BY tp."tipoId"
      ORDER BY tenant."createdAt", tenant."tenantId"
    ) = 1 THEN tp."tipoId"
    ELSE tp."tipoId" || '__' || SUBSTRING(
      MD5(tp."tipoId" || ':' || tenant."tenantId"),
      1,
      12
    )
  END AS "targetTipoId",
  ROW_NUMBER() OVER (
    PARTITION BY tp."tipoId"
    ORDER BY tenant."createdAt", tenant."tenantId"
  ) = 1 AS "keepsOriginal"
FROM "TipoPago" tp
CROSS JOIN "tenants" tenant
WHERE tp."tenantId" IS NULL;

-- Reuse the original row for the first tenant.
UPDATE "TipoPago" tp
SET
  "tenantId" = mapping."tenantId",
  "cuentaDefecto" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM "CuentaBancaria" account
      WHERE account."cuentaId" = mapping."sourceCuentaDefecto"
        AND account."tenantId" = mapping."tenantId"
    ) THEN mapping."sourceCuentaDefecto"
    ELSE NULL
  END
FROM "_TipoPagoTenantMap" mapping
WHERE mapping."sourceTipoId" = tp."tipoId"
  AND mapping."keepsOriginal" = TRUE;

-- Clone each global payment type for the remaining tenants.
INSERT INTO "TipoPago" (
  "tipoId",
  "tenantId",
  "nombre",
  "descripcion",
  "requiereCuenta",
  "cuentaDefecto",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  mapping."targetTipoId",
  mapping."tenantId",
  mapping."sourceNombre",
  mapping."sourceDescripcion",
  mapping."sourceRequiereCuenta",
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM "CuentaBancaria" account
      WHERE account."cuentaId" = mapping."sourceCuentaDefecto"
        AND account."tenantId" = mapping."tenantId"
    ) THEN mapping."sourceCuentaDefecto"
    ELSE NULL
  END,
  mapping."sourceIsActive",
  mapping."sourceCreatedAt",
  mapping."sourceUpdatedAt"
FROM "_TipoPagoTenantMap" mapping
WHERE mapping."keepsOriginal" = FALSE;

-- Point every reconciliation to the clone owned by its tenant.
UPDATE "ReconciliacionVenta" reconciliation
SET "tipoPagoId" = mapping."targetTipoId"
FROM "_TipoPagoTenantMap" mapping
WHERE mapping."sourceTipoId" = reconciliation."tipoPagoId"
  AND mapping."tenantId" = reconciliation."tenantId";

UPDATE "ReconciliacionServicio" reconciliation
SET "tipoPagoId" = mapping."targetTipoId"
FROM "_TipoPagoTenantMap" mapping
WHERE mapping."sourceTipoId" = reconciliation."tipoPagoId"
  AND mapping."tenantId" = reconciliation."tenantId";

UPDATE "ReconciliacionGasto" reconciliation
SET "tipoPagoId" = mapping."targetTipoId"
FROM "_TipoPagoTenantMap" mapping
WHERE mapping."sourceTipoId" = reconciliation."tipoPagoId"
  AND mapping."tenantId" = reconciliation."tenantId";

-- Abort instead of deploying partially-isolated data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "TipoPago" WHERE "tenantId" IS NULL) THEN
    RAISE EXCEPTION 'No se pudo asignar tenantId a todos los TipoPago';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ReconciliacionVenta" reconciliation
    JOIN "TipoPago" payment_type
      ON payment_type."tipoId" = reconciliation."tipoPagoId"
    WHERE payment_type."tenantId" <> reconciliation."tenantId"
  ) OR EXISTS (
    SELECT 1
    FROM "ReconciliacionServicio" reconciliation
    JOIN "TipoPago" payment_type
      ON payment_type."tipoId" = reconciliation."tipoPagoId"
    WHERE payment_type."tenantId" <> reconciliation."tenantId"
  ) OR EXISTS (
    SELECT 1
    FROM "ReconciliacionGasto" reconciliation
    JOIN "TipoPago" payment_type
      ON payment_type."tipoId" = reconciliation."tipoPagoId"
    WHERE payment_type."tenantId" <> reconciliation."tenantId"
  ) THEN
    RAISE EXCEPTION 'Existen reconciliaciones asociadas a un TipoPago de otro tenant';
  END IF;
END $$;

ALTER TABLE "TipoPago" ALTER COLUMN "tenantId" SET NOT NULL;

DROP TABLE "_TipoPagoTenantMap";

COMMIT;
