-- Migration: Add tenantId to transactional tables (Venta, Factura, GastosDE)
-- Step 1: Add columns as nullable
ALTER TABLE "Venta" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "facturas" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "GastosDE" ADD COLUMN "tenantId" TEXT;

-- Step 2: Backfill with default tenant
UPDATE "Venta" SET "tenantId" = (SELECT "tenantId" FROM "tenants" LIMIT 1);
UPDATE "facturas" SET "tenantId" = (SELECT "tenantId" FROM "tenants" LIMIT 1);
UPDATE "GastosDE" SET "tenantId" = (SELECT "tenantId" FROM "tenants" LIMIT 1);

-- Step 3: NOT NULL
ALTER TABLE "Venta" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "facturas" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "GastosDE" ALTER COLUMN "tenantId" SET NOT NULL;

-- Indexes
DROP INDEX IF EXISTS "facturas_numeroFactura_key";
CREATE INDEX "GastosDE_tenantId_idx" ON "GastosDE"("tenantId");
CREATE INDEX "GastosDE_tenantId_createdAt_idx" ON "GastosDE"("tenantId", "createdAt");
CREATE INDEX "Venta_tenantId_idx" ON "Venta"("tenantId");
CREATE INDEX "Venta_tenantId_createdAt_idx" ON "Venta"("tenantId", "createdAt");
CREATE INDEX "facturas_tenantId_idx" ON "facturas"("tenantId");
CREATE UNIQUE INDEX "facturas_tenantId_numeroFactura_key" ON "facturas"("tenantId", "numeroFactura");

-- Foreign keys
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GastosDE" ADD CONSTRAINT "GastosDE_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
