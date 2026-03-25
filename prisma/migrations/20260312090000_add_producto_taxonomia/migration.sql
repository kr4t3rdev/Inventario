-- Migration: Add optional business taxonomy fields to Producto
-- Created: 2026-03-12

ALTER TABLE "Producto"
  ADD COLUMN IF NOT EXISTS "codigoNegocio" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "familiaCodigo" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "subfamiliaCodigo" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "lineaCodigo" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "presentacionCodigo" VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS "Producto_codigoNegocio_key"
  ON "Producto"("codigoNegocio");
