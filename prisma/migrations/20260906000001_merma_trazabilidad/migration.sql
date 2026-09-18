-- Trazabilidad de mermas (CU-07): autor opcional y consulta por tenant y fecha.

ALTER TABLE "Merma" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "Merma" merma
SET "tenantId" = producto."tenantId"
FROM "Producto" producto
WHERE merma."productoId" = producto."id"
  AND merma."tenantId" IS NULL;
ALTER TABLE "Merma" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Merma" ADD CONSTRAINT "Merma_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Merma_tenantId_idx" ON "Merma"("tenantId");

ALTER TABLE "Merma" ADD COLUMN "creadoPorId" TEXT;

ALTER TABLE "Merma" ADD CONSTRAINT "Merma_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Merma_tenantId_createdAt_idx" ON "Merma"("tenantId", "createdAt");
