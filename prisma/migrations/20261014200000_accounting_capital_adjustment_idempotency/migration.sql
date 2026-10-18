-- Add tenant-scoped idempotency keys without rewriting existing accounting rows.
ALTER TABLE "InyeccionCapital" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "AjusteBancario" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "AjusteBancario" ADD COLUMN IF NOT EXISTS "payloadFingerprint" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "InyeccionCapital_tenantId_idempotencyKey_key"
  ON "InyeccionCapital"("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "AjusteBancario_tenantId_idempotencyKey_key"
  ON "AjusteBancario"("tenantId", "idempotencyKey");
