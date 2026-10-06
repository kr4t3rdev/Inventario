-- Add idempotencyKey to VentaServicios for retry safety
ALTER TABLE "VentaServicios" ADD COLUMN "idempotencyKey" TEXT;

-- Unique constraint for (tenantId, idempotencyKey) to prevent duplicates on retry
CREATE UNIQUE INDEX "VentaServicios_tenantId_idempotencyKey_key" ON "VentaServicios"("tenantId", "idempotencyKey");
