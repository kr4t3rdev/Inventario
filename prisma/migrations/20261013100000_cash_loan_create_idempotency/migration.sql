-- Durable idempotency for cash-loan creates, scoped to the owning tenant.
ALTER TABLE "ReconciliacionVenta"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "idempotencyPayloadHash" TEXT;

CREATE UNIQUE INDEX "ReconciliacionVenta_tenantId_idempotencyKey_key"
  ON "ReconciliacionVenta"("tenantId", "idempotencyKey");
