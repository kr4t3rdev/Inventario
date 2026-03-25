-- Migration: Add optional internal code to Producto
-- Created: 2026-03-11

ALTER TABLE "Producto"
  ADD COLUMN IF NOT EXISTS "codigoInterno" VARCHAR(11);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Producto_codigoInterno_11_digits_ck'
  ) THEN
    ALTER TABLE "Producto"
      ADD CONSTRAINT "Producto_codigoInterno_11_digits_ck"
      CHECK ("codigoInterno" IS NULL OR "codigoInterno" ~ '^[0-9]{11}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Producto_codigoInterno_key"
  ON "Producto"("codigoInterno");
