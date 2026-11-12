-- El esquema histórico creó recetaIngredienteId como PK y la migración de reparación copió
-- sus valores a id. Libera ese nombre legado para usarlo como FK opcional a una subreceta.
-- Idempotente: en bases donde la columna ya no existe (o nunca existió, p. ej. producción
-- creada vía db push), se agrega temporalmente para satisfacer el UPDATE y se libera
-- con DROP COLUMN IF EXISTS en lugar de fallar con 42703.
ALTER TABLE "RecetaIngrediente"
  ADD COLUMN IF NOT EXISTS "recetaIngredienteId" TEXT;

ALTER TABLE "RecetaIngrediente"
  DROP CONSTRAINT IF EXISTS "RecetaIngrediente_pkey";

UPDATE "RecetaIngrediente"
SET "id" = COALESCE("id", "recetaIngredienteId");

ALTER TABLE "RecetaIngrediente"
  ALTER COLUMN "id" SET NOT NULL;

ALTER TABLE "RecetaIngrediente"
  DROP COLUMN IF EXISTS "recetaIngredienteId";

ALTER TABLE "RecetaIngrediente"
  ADD CONSTRAINT "RecetaIngrediente_pkey" PRIMARY KEY ("id");

ALTER TABLE "RecetaIngrediente"
  ADD COLUMN "recetaIngredienteId" TEXT;

CREATE UNIQUE INDEX "Receta_tenantId_recetaId_key"
  ON "Receta"("tenantId", "recetaId");

CREATE INDEX "RecetaIngrediente_tenantId_recetaIngredienteId_idx"
  ON "RecetaIngrediente"("tenantId", "recetaIngredienteId");

ALTER TABLE "RecetaIngrediente"
  ADD CONSTRAINT "RecetaIngrediente_subreceta_tenant_fkey"
  FOREIGN KEY ("tenantId", "recetaIngredienteId")
  REFERENCES "Receta"("tenantId", "recetaId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
