ALTER TABLE "AjusteBancario"
ADD COLUMN "fechaOperacion" TIMESTAMP(3);

UPDATE "AjusteBancario"
SET "fechaOperacion" = "createdAt"
WHERE "fechaOperacion" IS NULL;

ALTER TABLE "AjusteBancario"
ALTER COLUMN "fechaOperacion" SET NOT NULL,
ALTER COLUMN "fechaOperacion" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "AjusteBancario_tenantId_fechaOperacion_idx"
ON "AjusteBancario"("tenantId", "fechaOperacion");
