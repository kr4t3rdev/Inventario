-- Vincular VentaServicios con Venta para deduplicar ingresos en cuadre (CU-05/F-06).

ALTER TABLE "VentaServicios" ADD COLUMN "ventaId" TEXT;

ALTER TABLE "VentaServicios" ADD CONSTRAINT "VentaServicios_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("ventaId") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "VentaServicios_ventaId_idx" ON "VentaServicios"("ventaId");
