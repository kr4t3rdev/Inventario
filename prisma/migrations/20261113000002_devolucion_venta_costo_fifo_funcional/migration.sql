-- La devolucion de venta reingresa la mercaderia al inventario por su costo
-- FIFO. Persistir ese costo ya valorado en moneda funcional permite que el
-- replay historico reconstruya el mismo asiento que emitio el writer, sin
-- recalcular tasas de un origen que no quedo registrado.
ALTER TABLE "devoluciones_venta"
  ADD COLUMN IF NOT EXISTS "costoFifoFuncional" DECIMAL(20, 4);
