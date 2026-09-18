-- Repair migration for databases that already recorded
-- 20260702093000_add_max_clientes_to_tenant_license before the missing Plan
-- column was restored.
ALTER TABLE "Plan"
  ADD COLUMN IF NOT EXISTS "maxClientes" INTEGER NOT NULL DEFAULT 200;
