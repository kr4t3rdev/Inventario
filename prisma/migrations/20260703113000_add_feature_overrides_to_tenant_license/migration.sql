-- Migration: Add featureOverrides to TenantLicense

ALTER TABLE "tenant_licenses"
ADD COLUMN "featureOverrides" JSONB;
