-- Migration: Add almacenId to Merma
-- Adds optional almacenId field to Merma model and reverse relation to Almacen

-- Add almacenId column to Merma table
ALTER TABLE "Merma" ADD COLUMN "almacenId" TEXT;

-- Add foreign key constraint
ALTER TABLE "Merma" ADD CONSTRAINT "Merma_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("almacenId") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create index for tenant and almacen queries
CREATE INDEX "Merma_almacenId_idx" ON "Merma"("almacenId");
