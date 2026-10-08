ALTER TABLE "ReconciliacionServicio"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "idempotencyHash" TEXT;

CREATE UNIQUE INDEX "ReconciliacionServicio_tenantId_idempotencyKey_key"
  ON "ReconciliacionServicio"("tenantId", "idempotencyKey");

ALTER TABLE "ReconciliacionServicio"
  ADD CONSTRAINT "ReconciliacionServicio_idempotencyPair_check"
  CHECK (
    ("idempotencyKey" IS NULL AND "idempotencyHash" IS NULL)
    OR
    ("idempotencyKey" IS NOT NULL AND "idempotencyHash" ~ '^[0-9a-f]{64}$')
  );
