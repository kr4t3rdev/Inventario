-- Vínculo estable de la obligación bruta con el servicio recibido.
ALTER TYPE "TipoEventoContable" ADD VALUE IF NOT EXISTS 'VENTA_SERVICIO_CREDITO';
ALTER TABLE "CuentaPorPagar" ADD COLUMN "compraServicioId" TEXT;
ALTER TABLE "CuentaPorPagar" ADD COLUMN "fxSnapshot" JSONB;
CREATE UNIQUE INDEX "CuentaPorPagar_compraServicioId_key"
ON "CuentaPorPagar"("compraServicioId");
ALTER TABLE "CuentaPorPagar" ADD CONSTRAINT "CuentaPorPagar_compraServicioId_fkey"
FOREIGN KEY ("compraServicioId") REFERENCES "CompraServicio"("compraServicioId")
ON DELETE SET NULL ON UPDATE CASCADE;
