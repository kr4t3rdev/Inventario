-- Lista de precios preferencial por cliente (CU-08).

ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "listaPrecioId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Cliente_listaPrecioId_fkey') THEN
    ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_listaPrecioId_fkey"
      FOREIGN KEY ("listaPrecioId") REFERENCES "ListaPrecio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Cliente_listaPrecioId_idx" ON "Cliente"("listaPrecioId");
