-- AS-05: denormalización de tenantId en TransaccionMoneda (espejo multimoneda).
-- Aditiva y reversible: columna nullable + índices. El backfill
-- (scripts/backfill/transaccion-moneda-tenant.ts) resuelve el tenant desde la
-- tabla padre según tipoTransaccion; NOT NULL solo cuando el 100% esté
-- resuelto (la escritura dual ya asigna tenantId en todos los writers).
--
-- Referencias por tipoTransaccion:
--   venta            -> Venta(id)
--   servicio         -> VentaServicios(ventaServicioId)
--   servicio_egreso  -> CompraServicio(compraServicioId)
--   gasto            -> polimórfico: GastosDE/GastoCompra/Pagosalario/CompraServicio/VentaServicios
--   exchange         -> sin padre (referenciaId UUID de request); backfill irresoluble, tenant solo por contexto

ALTER TABLE "TransaccionMoneda"
  ADD COLUMN "tenantId" TEXT;

CREATE INDEX "TransaccionMoneda_tenantId_idx"
  ON "TransaccionMoneda"("tenantId");

CREATE INDEX "TransaccionMoneda_tipoTransaccion_referenciaId_idx"
  ON "TransaccionMoneda"("tipoTransaccion", "referenciaId");