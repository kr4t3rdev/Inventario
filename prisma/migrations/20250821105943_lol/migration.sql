-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "descuento" INTEGER,
ADD COLUMN     "observaciones" TEXT,
ALTER COLUMN "clienteId" DROP NOT NULL;
