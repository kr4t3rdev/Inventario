-- Idempotencia durable del POST legacy de reconciliacion de ventas:
-- clave por tenant + huella del payload para reintentos seguros.
ALTER TABLE "ReconciliacionVenta" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "ReconciliacionVenta" ADD COLUMN "idempotencyPayloadHash" TEXT;
CREATE UNIQUE INDEX "ReconciliacionVenta_tenantId_idempotencyKey_key" ON "ReconciliacionVenta"("tenantId", "idempotencyKey");
