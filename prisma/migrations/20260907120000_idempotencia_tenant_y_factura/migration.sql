-- Idempotencia por tenant en recepciones (antes era única global entre
-- tenants) y en facturas de compra (CompraDocumento), cerrando la
-- duplicación por doble envío en ambos flujos.

DROP INDEX IF EXISTS "Recepcion_claveIdempotencia_key";

CREATE UNIQUE INDEX "Recepcion_tenantId_claveIdempotencia_key"
  ON "Recepcion"("tenantId", "claveIdempotencia");

ALTER TABLE "CompraDocumento" ADD COLUMN "claveIdempotencia" TEXT;

CREATE UNIQUE INDEX "CompraDocumento_tenantId_claveIdempotencia_key"
  ON "CompraDocumento"("tenantId", "claveIdempotencia");
