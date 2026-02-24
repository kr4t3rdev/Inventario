/*
  Warnings:

  - You are about to drop the column `fecha` on the `Merma` table. All the data in the column will be lost.
  - You are about to alter the column `precioCosto` on the `Producto` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `precioVenta` on the `Producto` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to drop the column `fecha` on the `Transferencia` table. All the data in the column will be lost.
  - You are about to drop the column `fecha` on the `Venta` table. All the data in the column will be lost.
  - Added the required column `almacenId` to the `Producto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `simbolo` to the `Unidad` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Merma" DROP CONSTRAINT "Merma_productoId_fkey";

-- DropForeignKey
ALTER TABLE "Producto" DROP CONSTRAINT "Producto_categoriaId_fkey";

-- DropForeignKey
ALTER TABLE "Producto" DROP CONSTRAINT "Producto_unidadId_fkey";

-- DropForeignKey
ALTER TABLE "Producto" DROP CONSTRAINT "Producto_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "Transferencia" DROP CONSTRAINT "Transferencia_destinoId_fkey";

-- DropForeignKey
ALTER TABLE "Transferencia" DROP CONSTRAINT "Transferencia_origenId_fkey";

-- DropForeignKey
ALTER TABLE "Transferencia" DROP CONSTRAINT "Transferencia_productoId_fkey";

-- DropForeignKey
ALTER TABLE "Venta" DROP CONSTRAINT "Venta_productoId_fkey";

-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "Merma" DROP COLUMN "fecha",
ADD COLUMN     "costoTotal" INTEGER;

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "almacenId" TEXT NOT NULL,
ADD COLUMN     "puntoDeVentaId" TEXT,
ADD COLUMN     "stockMinimo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subcategoriaId" TEXT,
ALTER COLUMN "precioCosto" SET DATA TYPE INTEGER,
ALTER COLUMN "precioVenta" SET DATA TYPE INTEGER,
ALTER COLUMN "unidadId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Transferencia" DROP COLUMN "fecha",
ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "puntoDeVentaDestinoId" TEXT,
ADD COLUMN     "puntoDeVentaOrigenId" TEXT,
ALTER COLUMN "origenId" DROP NOT NULL,
ALTER COLUMN "destinoId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Unidad" ADD COLUMN     "simbolo" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "role" SET DEFAULT 'regularUser';

-- AlterTable
ALTER TABLE "Venta" DROP COLUMN "fecha",
ADD COLUMN     "empleadoId" TEXT,
ADD COLUMN     "total" INTEGER;

-- CreateTable
CREATE TABLE "Almacen" (
    "almacenId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Almacen_pkey" PRIMARY KEY ("almacenId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "prioridad" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empleado" (
    "empleadoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "telefono" TEXT,
    "cargo" TEXT NOT NULL,
    "salarioBases" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "bonificaciones" INTEGER DEFAULT 0,
    "deducciones" INTEGER DEFAULT 0,
    "horasExtras" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("empleadoId")
);

-- CreateTable
CREATE TABLE "GastoCompra" (
    "gastoCompraId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "fechaCompra" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GastoCompra_pkey" PRIMARY KEY ("gastoCompraId")
);

-- CreateTable
CREATE TABLE "GastosServicios" (
    "gastoSId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "descripcion" TEXT,
    "isPagado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GastosServicios_pkey" PRIMARY KEY ("gastoSId")
);

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Categoria"("catId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("catId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "Categoria"("catId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "Unidad"("unidadId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("vendorId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("almacenId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_puntoDeVentaId_fkey" FOREIGN KEY ("puntoDeVentaId") REFERENCES "PuntoDeVenta"("pvId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("empleadoId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merma" ADD CONSTRAINT "Merma_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "Almacen"("almacenId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "Almacen"("almacenId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_puntoDeVentaOrigenId_fkey" FOREIGN KEY ("puntoDeVentaOrigenId") REFERENCES "PuntoDeVenta"("pvId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_puntoDeVentaDestinoId_fkey" FOREIGN KEY ("puntoDeVentaDestinoId") REFERENCES "PuntoDeVenta"("pvId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoCompra" ADD CONSTRAINT "GastoCompra_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoCompra" ADD CONSTRAINT "GastoCompra_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("vendorId") ON DELETE CASCADE ON UPDATE CASCADE;
