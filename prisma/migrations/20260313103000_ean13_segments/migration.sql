-- Migration: Add EAN-13 segment columns and remove legacy taxonomy columns
-- Created: 2026-03-13

ALTER TABLE "Producto"
  ADD COLUMN IF NOT EXISTS "proveedorCodigo" VARCHAR(2),
  ADD COLUMN IF NOT EXISTS "idSeccionCodigo" VARCHAR(2),
  ADD COLUMN IF NOT EXISTS "especificoCodigo" VARCHAR(4),
  ADD COLUMN IF NOT EXISTS "surtidoCodigo" VARCHAR(4),
  ADD COLUMN IF NOT EXISTS "dcCodigo" VARCHAR(1);

ALTER TABLE "Producto"
  DROP COLUMN IF EXISTS "familiaCodigo",
  DROP COLUMN IF EXISTS "subfamiliaCodigo",
  DROP COLUMN IF EXISTS "lineaCodigo",
  DROP COLUMN IF EXISTS "presentacionCodigo";
