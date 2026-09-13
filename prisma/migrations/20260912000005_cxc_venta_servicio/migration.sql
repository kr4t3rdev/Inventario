-- B-06: la venta de servicios a crédito genera cuenta por cobrar.
-- VentaServicios.condicionPago (CONTADO por defecto: sin cambio histórico) y
-- enlace 1:1 desde la CxC al servicio vendido a crédito.

ALTER TABLE "VentaServicios" ADD COLUMN "condicionPago" TEXT NOT NULL DEFAULT 'CONTADO';

ALTER TABLE "CuentaPorCobrar" ADD COLUMN "ventaServicioId" TEXT;
ALTER TABLE "CuentaPorCobrar" ADD CONSTRAINT "CuentaPorCobrar_ventaServicioId_fkey" FOREIGN KEY ("ventaServicioId") REFERENCES "VentaServicios"("ventaServicioId") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "CuentaPorCobrar_ventaServicioId_key" ON "CuentaPorCobrar"("ventaServicioId");
