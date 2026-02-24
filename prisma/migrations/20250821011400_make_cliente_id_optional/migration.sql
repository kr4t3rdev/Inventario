/*
  Warnings:

  - You are about to drop the `GastosServicios` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `clienteId` to the `Venta` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "clienteId" TEXT NOT NULL,
ADD COLUMN     "ordenId" TEXT,
ADD COLUMN     "serviciosId" TEXT,
ALTER COLUMN "productoId" DROP NOT NULL;

-- DropTable
DROP TABLE "GastosServicios";

-- CreateTable
CREATE TABLE "Cliente" (
    "clienteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("clienteId")
);

-- CreateTable
CREATE TABLE "Servicios" (
    "servicioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Servicios_pkey" PRIMARY KEY ("servicioId")
);

-- CreateTable
CREATE TABLE "GastosDE" (
    "gastosDEId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "descripcion" TEXT,
    "isPagado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GastosDE_pkey" PRIMARY KEY ("gastosDEId")
);

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_serviciosId_fkey" FOREIGN KEY ("serviciosId") REFERENCES "Servicios"("servicioId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteId") ON DELETE CASCADE ON UPDATE CASCADE;
