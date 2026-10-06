-- Idempotencia en InyeccionCapital para reintentos seguros.
-- Un reintento con la misma clave y mismo payload devuelve el registro existente;
-- con payload distinto se rechaza con IDEMPOTENCY_CONFLICT.
ALTER TABLE "InyeccionCapital" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "InyeccionCapital_tenantId_idempotencyKey_key"
  ON "InyeccionCapital"("tenantId", "idempotencyKey");
