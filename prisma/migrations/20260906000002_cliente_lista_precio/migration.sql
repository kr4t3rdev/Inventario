-- Lista de precios preferencial por cliente (CU-08).

ALTER TABLE "Cliente" ADD COLUMN "listaPrecioId" TEXT;

ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_listaPrecioId_fkey" FOREIGN KEY ("listaPrecioId") REFERENCES "ListaPrecio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Cliente_listaPrecioId_idx" ON "Cliente"("listaPrecioId");
