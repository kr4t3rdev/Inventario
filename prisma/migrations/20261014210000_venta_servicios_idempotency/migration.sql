-- Persist bounded, tenant-scoped idempotency fingerprints for service sales.
ALTER TABLE "VentaServicios"
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "VentaServicios_tenantId_idempotencyKey_key"
  ON "VentaServicios"("tenantId", "idempotencyKey");
