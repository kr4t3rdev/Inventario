-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('PEDIDO', 'ENTREGADA', 'FACTURADA', 'ANULADA');

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "estado" "EstadoVenta" NOT NULL DEFAULT 'ENTREGADA';

-- Backfill (PVE-T1). Orden vinculante: primero anuladas, luego facturadas por
-- vínculo a Factura (Factura.ventaId es unique); el resto queda en el default
-- ENTREGADA, que preserva la semántica histórica de "venta efectuada".
UPDATE "Venta" SET estado = 'ANULADA' WHERE "deletedAt" IS NOT NULL;
UPDATE "Venta" v SET estado = 'FACTURADA' FROM "facturas" f WHERE f."ventaId" = v."ventaId" AND v."deletedAt" IS NULL;
