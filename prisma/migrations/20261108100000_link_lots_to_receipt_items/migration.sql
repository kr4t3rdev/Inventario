-- Mantiene el origen físico del lote cuando el stock entra por una recepción de OC.
CREATE UNIQUE INDEX "RecepcionItem_tenantId_id_key"
  ON "RecepcionItem"("tenantId", "id");

ALTER TABLE "Lote" ADD COLUMN "recepcionItemId" TEXT;

ALTER TABLE "Lote"
  ADD CONSTRAINT "Lote_tenantId_recepcionItemId_fkey"
    FOREIGN KEY ("tenantId", "recepcionItemId")
    REFERENCES "RecepcionItem"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
