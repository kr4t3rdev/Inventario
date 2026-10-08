ALTER TABLE "Anticipo" ADD COLUMN "creationKey" TEXT;
ALTER TABLE "Anticipo" ADD COLUMN "creationHash" TEXT;
CREATE UNIQUE INDEX "Anticipo_tenantId_creationKey_key"
ON "Anticipo"("tenantId", "creationKey");
