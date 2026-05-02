-- Migration: Add Tenant, TenantMembership, TenantLicense + tenantId on MiEmpresa
-- Phase 1 of multi-tenant migration. All new columns are NULLABLE.
-- Constraints and NOT NULL will be enforced in a later phase.

-- AlterTable: Add tenantId to MiEmpresa (nullable, will be backfilled)
ALTER TABLE "MiEmpresa" ADD COLUMN "tenantId" TEXT;

-- CreateTable: tenants
CREATE TABLE "tenants" (
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable: tenant_memberships
CREATE TABLE "tenant_memberships" (
    "membershipId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantRole" TEXT NOT NULL DEFAULT 'dependiente',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("membershipId")
);

-- CreateTable: tenant_licenses
CREATE TABLE "tenant_licenses" (
    "tenantLicenseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiracion" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "maxUsuarios" INTEGER NOT NULL DEFAULT 1,
    "maxAlmacenes" INTEGER NOT NULL DEFAULT 1,
    "maxProductos" INTEGER NOT NULL DEFAULT 100,
    "features" JSONB,

    CONSTRAINT "tenant_licenses_pkey" PRIMARY KEY ("tenantLicenseId")
);

-- CreateIndex: unique slug for tenants
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex: membership indexes
CREATE INDEX "tenant_memberships_userId_idx" ON "tenant_memberships"("userId");
CREATE INDEX "tenant_memberships_tenantId_idx" ON "tenant_memberships"("tenantId");
CREATE UNIQUE INDEX "tenant_memberships_tenantId_userId_key" ON "tenant_memberships"("tenantId", "userId");

-- CreateIndex: license indexes
CREATE INDEX "tenant_licenses_tenantId_idx" ON "tenant_licenses"("tenantId");
CREATE INDEX "tenant_licenses_planId_idx" ON "tenant_licenses"("planId");

-- CreateIndex: unique tenantId on MiEmpresa for 1:1 relation
CREATE UNIQUE INDEX "MiEmpresa_tenantId_key" ON "MiEmpresa"("tenantId");

-- AddForeignKey: tenant_memberships -> tenants
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: tenant_memberships -> User
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: tenant_licenses -> tenants
ALTER TABLE "tenant_licenses" ADD CONSTRAINT "tenant_licenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: tenant_licenses -> Plan
ALTER TABLE "tenant_licenses" ADD CONSTRAINT "tenant_licenses_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("planId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: MiEmpresa -> tenants
ALTER TABLE "MiEmpresa" ADD CONSTRAINT "MiEmpresa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE SET NULL ON UPDATE CASCADE;
