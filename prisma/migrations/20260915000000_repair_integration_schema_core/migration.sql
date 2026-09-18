-- Repair core columns required by the current Prisma client and integration suite.
-- Keep legacy rows usable: tenant-scoped columns are nullable until historical
-- data is explicitly backfilled by a tenant-aware rollout.

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "contabilidadTimezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';

ALTER TABLE "Plan"
  ADD COLUMN IF NOT EXISTS "incluyeBackups" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "maxContratos" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "maxFacturasMes" INTEGER NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS "maxPuntosVenta" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "googleId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key"
  ON "User" ("googleId");

ALTER TABLE "Contrato"
  ADD COLUMN IF NOT EXISTS "numeroConsecutivo" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "numeroContratoClienteProveedor" TEXT,
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

UPDATE "Contrato" AS contrato
SET "tenantId" = cliente."tenantId"
FROM "Cliente" AS cliente
WHERE contrato."tenantId" IS NULL
  AND cliente."clienteId" = contrato."clienteId";

UPDATE "Contrato" AS contrato
SET "tenantId" = vendor."tenantId"
FROM "Vendor" AS vendor
WHERE contrato."tenantId" IS NULL
  AND vendor."vendorId" = contrato."vendorId";

CREATE INDEX IF NOT EXISTS "Contrato_tenantId_idx"
  ON "Contrato" ("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Contrato_tenantId_fkey'
  ) THEN
    ALTER TABLE "Contrato"
      ADD CONSTRAINT "Contrato_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants" ("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Empleado"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

CREATE INDEX IF NOT EXISTS "Empleado_tenantId_idx"
  ON "Empleado" ("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Empleado_tenantId_fkey'
  ) THEN
    ALTER TABLE "Empleado"
      ADD CONSTRAINT "Empleado_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants" ("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "GastoCompra"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

CREATE INDEX IF NOT EXISTS "GastoCompra_tenantId_idx"
  ON "GastoCompra" ("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GastoCompra_tenantId_fkey'
  ) THEN
    ALTER TABLE "GastoCompra"
      ADD CONSTRAINT "GastoCompra_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants" ("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "OrdenProduccion"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "costoMateriales" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "OrdenProduccion_tenantId_idx"
  ON "OrdenProduccion" ("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OrdenProduccion_tenantId_fkey'
  ) THEN
    ALTER TABLE "OrdenProduccion"
      ADD CONSTRAINT "OrdenProduccion_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants" ("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "GastosDE"
  ALTER COLUMN "tipo" DROP NOT NULL;

ALTER TABLE "Receta"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "productoId" TEXT;

CREATE INDEX IF NOT EXISTS "Receta_tenantId_idx"
  ON "Receta" ("tenantId");

ALTER TABLE "RecetaIngrediente"
  ADD COLUMN IF NOT EXISTS "id" TEXT,
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "unidadSimbolo" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'RecetaIngrediente'
      AND column_name = 'recetaIngredienteId'
  ) THEN
    EXECUTE 'UPDATE "RecetaIngrediente"
      SET "id" = COALESCE("id", "recetaIngredienteId"::TEXT)';
  END IF;
END $$;

UPDATE "RecetaIngrediente"
SET "id" = gen_random_uuid()::TEXT
WHERE "id" IS NULL;

ALTER TABLE "RecetaIngrediente"
  ALTER COLUMN "id" SET DEFAULT ((gen_random_uuid())::TEXT);

ALTER TABLE "Oferta"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

UPDATE "Oferta" AS oferta
SET "tenantId" = cliente."tenantId"
FROM "Cliente" AS cliente
WHERE oferta."tenantId" IS NULL
  AND cliente."clienteId" = oferta."clienteId";

CREATE INDEX IF NOT EXISTS "Oferta_tenantId_idx"
  ON "Oferta" ("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Oferta_tenantId_fkey'
  ) THEN
    ALTER TABLE "Oferta"
      ADD CONSTRAINT "Oferta_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants" ("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
