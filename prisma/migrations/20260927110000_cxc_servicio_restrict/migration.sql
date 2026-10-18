-- C-5: la CxC de una venta de servicio no puede quedar huérfana.
-- SetNull → Restrict: el delete de la venta se bloquea a nivel de base si una
-- CxC la referencia; la action limpia las CxC ANULADA en la misma transacción.
ALTER TABLE "CuentaPorCobrar" DROP CONSTRAINT "CuentaPorCobrar_ventaServicioId_fkey";
ALTER TABLE "CuentaPorCobrar" ADD CONSTRAINT "CuentaPorCobrar_ventaServicioId_fkey" FOREIGN KEY ("ventaServicioId") REFERENCES "VentaServicios"("ventaServicioId") ON DELETE RESTRICT ON UPDATE CASCADE;
