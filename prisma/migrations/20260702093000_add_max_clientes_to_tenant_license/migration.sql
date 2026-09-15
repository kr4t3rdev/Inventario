-- Migration: Add maxClientes to TenantLicense
-- Keeps tenant license client limits aligned with the selected plan.

-- The field was present in the Prisma schema before it was represented in
-- migration history. Create it before copying plan limits into licenses.
ALTER TABLE "Plan"
  ADD COLUMN IF NOT EXISTS "maxClientes" INTEGER NOT NULL DEFAULT 200;

ALTER TABLE "tenant_licenses"
  ADD COLUMN IF NOT EXISTS "maxClientes" INTEGER NOT NULL DEFAULT 200;

UPDATE "tenant_licenses" AS tl
SET "maxClientes" = p."maxClientes"
FROM "Plan" AS p
WHERE tl."planId" = p."planId";
