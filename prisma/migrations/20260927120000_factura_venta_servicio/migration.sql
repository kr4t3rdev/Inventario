-- C-6: documento de factura para ventas de servicios (Factura.ventaServicioId 1:1).
ALTER TABLE "facturas" ADD COLUMN "ventaServicioId" TEXT;
CREATE UNIQUE INDEX "Factura_ventaServicioId_key" ON "facturas"("ventaServicioId");
ALTER TABLE "facturas" ADD CONSTRAINT "Factura_ventaServicioId_fkey" FOREIGN KEY ("ventaServicioId") REFERENCES "VentaServicios"("ventaServicioId") ON DELETE RESTRICT ON UPDATE CASCADE;
