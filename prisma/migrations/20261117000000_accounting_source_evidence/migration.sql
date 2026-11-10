-- Nullable evidence preserves legacy rows without inventing historical values.
ALTER TABLE "AjusteInventario"
  ADD COLUMN "mermaReversionFecha" TIMESTAMP(3),
  ADD COLUMN "mermaReversionRegistradaAt" TIMESTAMP(3);

ALTER TABLE "purchase_allocations"
  ADD COLUMN "fifoMonedaOrigen" TEXT,
  ADD COLUMN "fifoFechaFuente" TIMESTAMP(3),
  ADD COLUMN "fifoMonedaFuncional" TEXT,
  ADD COLUMN "fifoCostoFuncional" DECIMAL(20,4),
  ADD COLUMN "fifoTasaCambio" DECIMAL(20,10),
  ADD COLUMN "fifoFechaTasa" TIMESTAMP(3),
  ADD COLUMN "fifoEvidenciaFx" TEXT;
