-- Migration: Add tenantId to master tables (Producto, Categoria, Vendor, Cliente, Almacen, PuntoDeVenta)
-- Step 1: Add columns as nullable
ALTER TABLE "Almacen" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Categoria" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Producto" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "PuntoDeVenta" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "tenantId" TEXT;

-- Step 2: Backfill with default tenant
UPDATE "Almacen" SET "tenantId" = (SELECT "tenantId" FROM "tenants" LIMIT 1);
UPDATE "Categoria" SET "tenantId" = (SELECT "tenantId" FROM "tenants" LIMIT 1);
UPDATE "Cliente" SET "tenantId" = (SELECT "tenantId" FROM "tenants" LIMIT 1);
UPDATE "Producto" SET "tenantId" = (SELECT "tenantId" FROM "tenants" LIMIT 1);
UPDATE "PuntoDeVenta" SET "tenantId" = (SELECT "tenantId" FROM "tenants" LIMIT 1);
UPDATE "Vendor" SET "tenantId" = (SELECT "tenantId" FROM "tenants" LIMIT 1);

-- Step 3: Make NOT NULL
ALTER TABLE "Almacen" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Categoria" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Cliente" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Producto" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "PuntoDeVenta" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Vendor" ALTER COLUMN "tenantId" SET NOT NULL;

-- Indexes
CREATE INDEX "Almacen_tenantId_idx" ON "Almacen"("tenantId");
CREATE INDEX "Categoria_tenantId_idx" ON "Categoria"("tenantId");
CREATE INDEX "Cliente_tenantId_idx" ON "Cliente"("tenantId");
CREATE INDEX "PuntoDeVenta_tenantId_idx" ON "PuntoDeVenta"("tenantId");
CREATE INDEX "Vendor_tenantId_idx" ON "Vendor"("tenantId");
CREATE INDEX "Producto_tenantId_idx" ON "Producto"("tenantId");
CREATE INDEX "Producto_tenantId_categoriaId_idx" ON "Producto"("tenantId", "categoriaId");
CREATE INDEX "Producto_tenantId_vendorId_idx" ON "Producto"("tenantId", "vendorId");

-- Composite unique constraints (replace global uniques)
DROP INDEX IF EXISTS "Producto_codigoInterno_key";
DROP INDEX IF EXISTS "Producto_codigoNegocio_key";
DROP INDEX IF EXISTS "Vendor_vendorCode_key";
CREATE UNIQUE INDEX "Producto_tenantId_codigoInterno_key" ON "Producto"("tenantId", "codigoInterno");
CREATE UNIQUE INDEX "Producto_tenantId_codigoNegocio_key" ON "Producto"("tenantId", "codigoNegocio");
CREATE UNIQUE INDEX "Vendor_tenantId_vendorCode_key" ON "Vendor"("tenantId", "vendorCode");

-- Foreign keys to tenants
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Almacen" ADD CONSTRAINT "Almacen_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PuntoDeVenta" ADD CONSTRAINT "PuntoDeVenta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
