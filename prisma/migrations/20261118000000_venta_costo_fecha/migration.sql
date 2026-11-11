-- CT-1: fecha efectiva del devengo del costo de venta.
-- El writer la persiste en el momento del devengo (entrega del PVE o creacion
-- en POS) para que el replay historico reconstruya el mismo periodo sin
-- re-derivar la fecha desde marcas de tiempo mutables.
ALTER TABLE "Venta" ADD COLUMN "costoVentaFecha" TIMESTAMP(3);

-- Backfill de las ventas que el criterio anterior (`updatedAt = createdAt`)
-- si reconstruia. Sin esta columna, toda venta historica queda sin fecha de
-- devengo y el replay la omite con FECHA_COSTO_FIFO_NO_PERSISTIDA, con lo
-- que los periodos previos nunca se acreditan.
--
-- Solo se repone la fecha cuando la venta nunca fue modificada despues de
-- crearse: en ese caso el devengo ocurrio en el acto (venta POS creada ya
-- entregada) y la fecha del devengo es la de creacion. Las ventas PVE
-- entregadas mas tarde tienen la fecha de devengo realmente desconocida:
-- se dejan sin backfill y el replay las omite de forma explicita.
--
-- La misma logica existe como script idempotente para los entornos cuyo
-- sincronizado de esquema usa `prisma db push` (que no ejecuta este SQL):
-- scripts/ops/backfill-venta-costo-fecha.ts
UPDATE "Venta"
SET "costoVentaFecha" = "createdAt"
WHERE "costoVentaFecha" IS NULL
  AND "updatedAt" = "createdAt"
  AND "deletedAt" IS NULL
  AND "estado" IN ('ENTREGADA', 'FACTURADA');
