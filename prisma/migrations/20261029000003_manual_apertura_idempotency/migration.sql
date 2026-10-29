ALTER TABLE "apertura_periodo_solicitudes"
    ADD COLUMN "idempotencyKey" TEXT,
    ADD COLUMN "idempotencyPayloadHash" TEXT;

CREATE UNIQUE INDEX "apertura_periodo_solicitudes_tenantId_solicitadaPor_idempotencyKey_key"
    ON "apertura_periodo_solicitudes"("tenantId", "solicitadaPor", "idempotencyKey");
