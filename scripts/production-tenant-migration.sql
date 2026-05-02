-- PRODUCTION MIGRATION: Multi-Tenant for TCP
-- Generated 2026-05-01. Run against the production Neon DB.
-- This adds tenantId to all business tables with backfill + indexes + FKs.

-- ======= STEP 1: Core tenant models =======
-- (Skip if tenants table already exists)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename='tenants') THEN

CREATE TABLE "tenants" (
    "tenantId" TEXT NOT NULL, "nombre" TEXT NOT NULL, "slug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("tenantId")
);
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

CREATE TABLE "tenant_memberships" (
    "membershipId" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL,
    "tenantRole" TEXT NOT NULL DEFAULT 'dependiente', "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("membershipId")
);
CREATE UNIQUE INDEX "tm_tenant_user_key" ON "tenant_memberships"("tenantId","userId");
CREATE INDEX "tm_tenant_idx" ON "tenant_memberships"("tenantId");
CREATE INDEX "tm_user_idx" ON "tenant_memberships"("userId");

CREATE TABLE "tenant_licenses" (
    "tenantLicenseId" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "planId" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true, "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiracion" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "maxUsuarios" INTEGER NOT NULL DEFAULT 1, "maxAlmacenes" INTEGER NOT NULL DEFAULT 1,
    "maxProductos" INTEGER NOT NULL DEFAULT 100, "features" JSONB,
    CONSTRAINT "tenant_licenses_pkey" PRIMARY KEY ("tenantLicenseId")
);
CREATE INDEX "tl_tenant_idx" ON "tenant_licenses"("tenantId");

ALTER TABLE "MiEmpresa" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "MiEmpresa_tenantId_key" ON "MiEmpresa"("tenantId");

END IF; END $$;

-- ======= STEP 2: Create default tenant and backfill =======
INSERT INTO "tenants" ("tenantId", "nombre", "slug", "createdAt", "updatedAt")
SELECT 'default-tenant', 'Default', 'default', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "tenants" LIMIT 1);

UPDATE "MiEmpresa" SET "tenantId" = (SELECT "tenantId" FROM "tenants" LIMIT 1) WHERE "tenantId" IS NULL;

-- ======= STEP 3: Master tables =======
ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Categoria" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Almacen" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "PuntoDeVenta" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- ======= STEP 4: Transactional tables =======
ALTER TABLE "Venta" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "GastosDE" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- ======= STEP 5: Purchase domain =======
ALTER TABLE "GastoCompra" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "CompraProducto" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "CompraDocumento" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "CompraDocumentoItem" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Servicios" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "VentaServicios" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "CompraServicio" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- ======= STEP 6: Financial =======
ALTER TABLE "CuentaBancaria" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "ReconciliacionVenta" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "ReconciliacionServicio" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "ReconciliacionGasto" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "AjusteBancario" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "TransferenciaBancaria" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Contrato" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "series_facturacion" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Oferta" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "CuentaPorCobrar" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "CuentaPorPagar" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "DeudaCash" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "PrestamoCash" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "PagoCuentaPorPagar" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Empleado" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- ======= STEP 7: Production + Repair =======
ALTER TABLE "Receta" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "RecetaIngrediente" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "ValeSalida" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "ValeSalidaItem" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "OrdenProduccion" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "OrdenProduccionHistorial" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "EquipoReparacion" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "PiezaReparacion" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "OrdenReparacion" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "OrdenReparacionEquipo" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "OrdenReparacionItem" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "OrdenReparacionMaterial" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "DefectacionCatalogo" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "StockUbicacion" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Transferencia" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Merma" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "ListaPrecio" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Anticipo" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Pagosalario" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "CierreContable" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- ======= STEP 8: Backfill all nulls =======
DO $$ DECLARE tid TEXT; BEGIN
SELECT "tenantId" INTO tid FROM "tenants" LIMIT 1;
IF tid IS NOT NULL THEN
  UPDATE "Producto" SET "tenantId" = tid WHERE "tenantId" IS NULL;
  UPDATE "Categoria" SET "tenantId" = tid WHERE "tenantId" IS NULL;
  UPDATE "Vendor" SET "tenantId" = tid WHERE "tenantId" IS NULL;
  UPDATE "Cliente" SET "tenantId" = tid WHERE "tenantId" IS NULL;
  UPDATE "Almacen" SET "tenantId" = tid WHERE "tenantId" IS NULL;
  UPDATE "PuntoDeVenta" SET "tenantId" = tid WHERE "tenantId" IS NULL;
  UPDATE "Venta" SET "tenantId" = tid WHERE "tenantId" IS NULL;
  UPDATE "facturas" SET "tenantId" = tid WHERE "tenantId" IS NULL;
  UPDATE "GastosDE" SET "tenantId" = tid WHERE "tenantId" IS NULL;
  UPDATE "Empleado" SET "tenantId" = tid WHERE "tenantId" IS NULL;
END IF; END $$;

-- Create memberships for existing users
INSERT INTO "tenant_memberships" ("membershipId", "tenantId", "userId", "tenantRole", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, (SELECT "tenantId" FROM "tenants" LIMIT 1), u."userId",
  CASE WHEN u."role" = 'admin' THEN 'admin' ELSE 'dependiente' END, true, NOW(), NOW()
FROM "User" u WHERE u."isActive" = true
AND NOT EXISTS (SELECT 1 FROM "tenant_memberships" tm WHERE tm."userId" = u."userId");
