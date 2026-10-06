-- Evita duplicados de restock ante carrera concurrente con la misma factura.
-- NULLs no colisionan en PostgreSQL (restocks sin factura usan auto-generado).
CREATE UNIQUE INDEX "GastoCompra_tenantId_numeroFactura_key"
  ON "GastoCompra"("tenantId", "numeroFactura");
