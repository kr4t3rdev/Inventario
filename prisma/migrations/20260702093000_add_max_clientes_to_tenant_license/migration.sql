-- Migration: Add maxClientes to TenantLicense
-- Keeps tenant license client limits aligned with the selected plan.

ALTER TABLE "tenant_licenses"
  ADD COLUMN IF NOT EXISTS "maxClientes" INTEGER NOT NULL DEFAULT 200;

UPDATE "tenant_licenses" AS tl
SET "maxClientes" = p."maxClientes"
FROM "Plan" AS p
WHERE tl."planId" = p."planId";
