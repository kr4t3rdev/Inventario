BEGIN;

-- Add the tenant column before building the per-tenant mapping.
ALTER TABLE "Unidad" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- Remove global uniques before creating tenant-specific rows. Existing
-- assigned rows that conflict with a legacy global row abort the transaction
-- instead of silently merging units.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"Unidad"'::regclass AND conname = 'Unidad_nombre_key'
  ) THEN
    ALTER TABLE "Unidad" DROP CONSTRAINT "Unidad_nombre_key";
  ELSIF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relkind = 'i' AND relname = 'Unidad_nombre_key'
  ) THEN
    DROP INDEX "Unidad_nombre_key";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"Unidad"'::regclass AND conname = 'Unidad_simbolo_key'
  ) THEN
    ALTER TABLE "Unidad" DROP CONSTRAINT "Unidad_simbolo_key";
  ELSIF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relkind = 'i' AND relname = 'Unidad_simbolo_key'
  ) THEN
    DROP INDEX "Unidad_simbolo_key";
  END IF;
END $$;

-- Map every legacy global unit to every tenant. The first tenant keeps the
-- original primary key; clones get new IDs. Products are remapped before the
-- clones are inserted, so no referenced unit is deleted or cascades products.
CREATE TEMP TABLE "_UnidadTenantMap" (
  "sourceUnidadId" TEXT NOT NULL,
  "targetUnidadId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "simbolo" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "keepsOriginal" BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO "_UnidadTenantMap" (
  "sourceUnidadId",
  "targetUnidadId",
  "tenantId",
  "nombre",
  "simbolo",
  "createdAt",
  "updatedAt",
  "keepsOriginal"
)
SELECT
  unidad."unidadId",
  CASE
    WHEN ROW_NUMBER() OVER (
      PARTITION BY unidad."unidadId"
      ORDER BY tenant."createdAt", tenant."tenantId"
    ) = 1 THEN unidad."unidadId"
    ELSE 'c' || SUBSTRING(
      MD5(unidad."unidadId" || ':' || tenant."tenantId"),
      1,
      24
    )
  END,
  tenant."tenantId",
  unidad."nombre",
  unidad."simbolo",
  unidad."createdAt",
  unidad."updatedAt",
  ROW_NUMBER() OVER (
    PARTITION BY unidad."unidadId"
    ORDER BY tenant."createdAt", tenant."tenantId"
  ) = 1
FROM "Unidad" unidad
CROSS JOIN "tenants" tenant
WHERE unidad."tenantId" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "_UnidadTenantMap" mapping
    JOIN "Unidad" existing
      ON existing."tenantId" = mapping."tenantId"
     AND existing."nombre" = mapping."nombre"
    WHERE existing."unidadId" <> mapping."sourceUnidadId"
  ) THEN
    RAISE EXCEPTION 'Conflicto de nombre de Unidad durante el backfill tenant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "_UnidadTenantMap" mapping
    JOIN "Unidad" existing
      ON existing."tenantId" = mapping."tenantId"
     AND existing."simbolo" = mapping."simbolo"
    WHERE existing."unidadId" <> mapping."sourceUnidadId"
  ) THEN
    RAISE EXCEPTION 'Conflicto de simbolo de Unidad durante el backfill tenant';
  END IF;
END $$;

UPDATE "Producto" producto
SET "unidadId" = mapping."targetUnidadId"
FROM "_UnidadTenantMap" mapping
WHERE producto."unidadId" = mapping."sourceUnidadId"
  AND producto."tenantId" = mapping."tenantId";

INSERT INTO "Unidad" (
  "unidadId",
  "tenantId",
  "nombre",
  "simbolo",
  "createdAt",
  "updatedAt"
)
SELECT
  mapping."targetUnidadId",
  mapping."tenantId",
  mapping."nombre",
  mapping."simbolo",
  mapping."createdAt",
  mapping."updatedAt"
FROM "_UnidadTenantMap" mapping
WHERE mapping."keepsOriginal" = FALSE;

UPDATE "Unidad" unidad
SET "tenantId" = mapping."tenantId"
FROM "_UnidadTenantMap" mapping
WHERE unidad."unidadId" = mapping."sourceUnidadId"
  AND mapping."keepsOriginal" = TRUE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Unidad" WHERE "tenantId" IS NULL) THEN
    RAISE EXCEPTION 'No se pudo asignar tenantId a todas las Unidad';
  END IF;
END $$;

ALTER TABLE "Unidad" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Unidad_tenantId_nombre_key"
  ON "Unidad"("tenantId", "nombre");
CREATE UNIQUE INDEX IF NOT EXISTS "Unidad_tenantId_simbolo_key"
  ON "Unidad"("tenantId", "simbolo");
CREATE INDEX IF NOT EXISTS "Unidad_tenantId_idx" ON "Unidad"("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"Unidad"'::regclass
      AND conname = 'Unidad_tenantId_fkey'
  ) THEN
    ALTER TABLE "Unidad"
      ADD CONSTRAINT "Unidad_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Producto" DROP CONSTRAINT IF EXISTS "Producto_unidadId_fkey";
ALTER TABLE "Producto"
  ADD CONSTRAINT "Producto_unidadId_fkey"
  FOREIGN KEY ("unidadId") REFERENCES "Unidad"("unidadId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
