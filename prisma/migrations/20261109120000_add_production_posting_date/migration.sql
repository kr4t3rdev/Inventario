-- Persist the exact effective date used by the formal production posting.
ALTER TABLE "OrdenProduccion"
ADD COLUMN "fechaContabilizacion" TIMESTAMP(3);
