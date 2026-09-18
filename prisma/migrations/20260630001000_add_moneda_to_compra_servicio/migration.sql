BEGIN;

ALTER TABLE "CompraServicio"
ADD COLUMN IF NOT EXISTS "moneda" TEXT;

UPDATE "CompraServicio" cs
SET "moneda" = s."moneda"
FROM "Servicios" s
WHERE s."servicioId" = cs."servicioId"
  AND cs."moneda" IS NULL;

CREATE INDEX IF NOT EXISTS "CompraServicio_moneda_idx"
ON "CompraServicio"("moneda");

COMMIT;
