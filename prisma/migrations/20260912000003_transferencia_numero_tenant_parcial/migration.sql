-- B-01: numeración de transferencias por tenant y evidencia de recepción parcial.
-- El correlativo se cuenta por tenant, por eso la unicidad pasa de global a
-- (tenantId, numeroTransferencia). Valores existentes: únicos globales hoy, no
-- colisionan al migrarse. cantidadRecibida = unidades confirmadas al recibir
-- (NULL mantiene el comportamiento histórico de recepción total).

ALTER TABLE "Transferencia" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "Transferencia" transfer
SET "tenantId" = producto."tenantId"
FROM "Producto" producto
WHERE transfer."productoId" = producto."id"
  AND transfer."tenantId" IS NULL;
ALTER TABLE "Transferencia" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Transferencia_tenantId_idx" ON "Transferencia"("tenantId");

ALTER TABLE "Transferencia" ADD COLUMN "cantidadRecibida" INTEGER;

ALTER TABLE "Transferencia" DROP CONSTRAINT IF EXISTS "Transferencia_numeroTransferencia_key";
CREATE UNIQUE INDEX "Transferencia_tenantId_numeroTransferencia_key" ON "Transferencia"("tenantId", "numeroTransferencia");
