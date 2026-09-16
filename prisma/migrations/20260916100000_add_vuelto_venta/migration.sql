-- VC: vuelto en el POS. Ambas columnas nullable: sin backfill necesario
-- (las ventas históricas quedan sin recibido/cambio).

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "cambioDevuelto" INTEGER,
ADD COLUMN     "montoRecibidoEfectivo" INTEGER;
