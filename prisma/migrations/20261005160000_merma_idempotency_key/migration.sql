-- G2: clave de idempotencia en Merma para reintentos seguros.
-- Un reintento con la misma clave devuelve el registro existente en lugar de
-- duplicar merma, movimiento de stock, ajuste espejo y asiento.
ALTER TABLE "Merma" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Merma_tenantId_idempotencyKey_key"
  ON "Merma"("tenantId", "idempotencyKey");
