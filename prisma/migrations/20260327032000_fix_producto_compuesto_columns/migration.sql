-- Align Producto table with current schema for compound products
ALTER TABLE "Producto"
  ADD COLUMN IF NOT EXISTS "esCompuesto" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "cantidadEnPack" INTEGER,
  ADD COLUMN IF NOT EXISTS "productoPadreId" TEXT;

-- Self-relation FK for compound products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Producto_productoPadreId_fkey'
  ) THEN
    ALTER TABLE "Producto"
      ADD CONSTRAINT "Producto_productoPadreId_fkey"
      FOREIGN KEY ("productoPadreId") REFERENCES "Producto"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Producto_esCompuesto_idx" ON "Producto"("esCompuesto");
CREATE INDEX IF NOT EXISTS "Producto_productoPadreId_idx" ON "Producto"("productoPadreId");
