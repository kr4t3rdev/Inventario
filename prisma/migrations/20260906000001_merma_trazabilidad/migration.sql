-- Trazabilidad de mermas (CU-07): autor opcional y consulta por tenant y fecha.

ALTER TABLE "Merma" ADD COLUMN "creadoPorId" TEXT;

ALTER TABLE "Merma" ADD CONSTRAINT "Merma_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Merma_tenantId_createdAt_idx" ON "Merma"("tenantId", "createdAt");
