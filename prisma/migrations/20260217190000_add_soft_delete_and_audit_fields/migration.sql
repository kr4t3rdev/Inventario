-- Migration: Add soft delete and audit fields to CompraProducto, GastoCompra, CuentaPorPagar, and Producto
-- Created: 2025-02-17

-- Add columns to CompraProducto
ALTER TABLE "CompraProducto" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "CompraProducto" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "CompraProducto" ADD COLUMN IF NOT EXISTS "updatedById" TEXT;

-- Add index for deletedAt
CREATE INDEX IF NOT EXISTS "CompraProducto_deletedAt_idx" ON "CompraProducto"("deletedAt");

-- Add foreign keys for User relations (drop first if exists)
ALTER TABLE "CompraProducto" DROP CONSTRAINT IF EXISTS "CompraProducto_createdById_fkey";
ALTER TABLE "CompraProducto" ADD CONSTRAINT "CompraProducto_createdById_fkey" 
  FOREIGN KEY ("createdById") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompraProducto" DROP CONSTRAINT IF EXISTS "CompraProducto_updatedById_fkey";
ALTER TABLE "CompraProducto" ADD CONSTRAINT "CompraProducto_updatedById_fkey" 
  FOREIGN KEY ("updatedById") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add columns to GastoCompra
ALTER TABLE "GastoCompra" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Add index for deletedAt
CREATE INDEX IF NOT EXISTS "GastoCompra_deletedAt_idx" ON "GastoCompra"("deletedAt");

-- Add columns to CuentaPorPagar
ALTER TABLE "CuentaPorPagar" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Add index for deletedAt
CREATE INDEX IF NOT EXISTS "CuentaPorPagar_deletedAt_idx" ON "CuentaPorPagar"("deletedAt");

-- Add columns to Producto
ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Add index for deletedAt
CREATE INDEX IF NOT EXISTS "Producto_deletedAt_idx" ON "Producto"("deletedAt");
