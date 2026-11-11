-- CT-1: fecha efectiva del devengo del costo de venta.
-- El writer la persiste en el momento del devengo (entrega del PVE o creacion
-- en POS) para que el replay historico reconstruya el mismo periodo sin
-- re-derivar la fecha desde marcas de tiempo mutables.
ALTER TABLE "Venta" ADD COLUMN "costoVentaFecha" TIMESTAMP(3);
