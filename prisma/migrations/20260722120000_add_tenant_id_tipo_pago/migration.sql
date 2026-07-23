-- Add tenantId to TipoPago (nullable initially for backfill)
ALTER TABLE "TipoPago" ADD COLUMN "tenantId" TEXT;

-- Add index on tenantId for performance
CREATE INDEX "TipoPago_tenantId_idx" ON "TipoPago"("tenantId");

-- Add foreign key constraint
ALTER TABLE "TipoPago" ADD CONSTRAINT "TipoPago_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
