-- C3: clave de idempotencia en AjusteBancario para reintentos seguros.
-- Un reintento con la misma clave devuelve el registro existente en lugar de
-- duplicar el ajuste, el movimiento de saldo y el asiento.
ALTER TABLE "AjusteBancario" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "AjusteBancario_tenantId_idempotencyKey_key"
  ON "AjusteBancario"("tenantId", "idempotencyKey");
