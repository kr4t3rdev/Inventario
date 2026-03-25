-- CreateEnum
CREATE TYPE "FormaPagoCompra" AS ENUM ('PAGO_PARCIAL', 'PAGO_COMPLETO');

-- CreateEnum
CREATE TYPE "EstadoCompraProducto" AS ENUM ('PENDIENTE', 'PAGADA');

-- CreateEnum
CREATE TYPE "TipoOperacionCompra" AS ENUM ('RESTOCK', 'REGULAR');

-- CreateEnum
CREATE TYPE "TipoCuentaPorPagar" AS ENUM ('compra', 'servicio');

-- CreateEnum
CREATE TYPE "EstadoCuentaPorPagar" AS ENUM ('PENDIENTE', 'PAGADA', 'PARCIAL');

-- AlterTable
ALTER TABLE "GastosDE" ADD COLUMN "numeroFactura" TEXT;

-- AlterTable
ALTER TABLE "GastoCompra" ADD COLUMN "periodo" TEXT, ADD COLUMN "numeroFactura" TEXT, ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CuentaPorPagar" (
    "cuentaPorPagarId" TEXT NOT NULL,
    "numeroFactura" TEXT NOT NULL,
    "gastoCompraId" TEXT,
    "gastosDEId" TEXT,
    "proveedorNombre" TEXT,
    "montoDeuda" DECIMAL(65,30) NOT NULL,
    "montoPagado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "saldoPendiente" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'CUP',
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "estado" "EstadoCuentaPorPagar" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "proveedorId" TEXT,
    "tipo" "TipoCuentaPorPagar" NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CuentaPorPagar_pkey" PRIMARY KEY ("cuentaPorPagarId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CuentaPorPagar_gastoCompraId_key" ON "CuentaPorPagar"("gastoCompraId");
CREATE UNIQUE INDEX "CuentaPorPagar_gastosDEId_key" ON "CuentaPorPagar"("gastosDEId");

-- CreateTable
CREATE TABLE "CompraProducto" (
    "compraProductoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "numeroFactura" TEXT,
    "facturaUrl" TEXT,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "formaPago" "FormaPagoCompra" NOT NULL,
    "estado" "EstadoCompraProducto" NOT NULL DEFAULT 'PENDIENTE',
    "tipoOperacion" "TipoOperacionCompra" NOT NULL DEFAULT 'REGULAR',
    "descripcion" TEXT,
    "fechaCompra" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gastoCompraId" TEXT,
    "cuentaPorPagarId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompraProducto_pkey" PRIMARY KEY ("compraProductoId")
);

-- CreateIndex
CREATE INDEX "CompraProducto_productoId_idx" ON "CompraProducto"("productoId");

-- CreateIndex
CREATE INDEX "CompraProducto_vendorId_idx" ON "CompraProducto"("vendorId");

-- CreateIndex
CREATE INDEX "CompraProducto_tipoOperacion_idx" ON "CompraProducto"("tipoOperacion");

-- CreateIndex
CREATE UNIQUE INDEX "CompraProducto_gastoCompraId_key" ON "CompraProducto"("gastoCompraId");

-- CreateIndex
CREATE UNIQUE INDEX "CompraProducto_cuentaPorPagarId_key" ON "CompraProducto"("cuentaPorPagarId");

-- AddForeignKey
ALTER TABLE "CompraProducto" ADD CONSTRAINT "CompraProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraProducto" ADD CONSTRAINT "CompraProducto_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("vendorId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraProducto" ADD CONSTRAINT "CompraProducto_gastoCompraId_fkey" FOREIGN KEY ("gastoCompraId") REFERENCES "GastoCompra"("gastoCompraId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraProducto" ADD CONSTRAINT "CompraProducto_cuentaPorPagarId_fkey" FOREIGN KEY ("cuentaPorPagarId") REFERENCES "CuentaPorPagar"("cuentaPorPagarId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaPorPagar" ADD CONSTRAINT "CuentaPorPagar_gastoCompraId_fkey" FOREIGN KEY ("gastoCompraId") REFERENCES "GastoCompra"("gastoCompraId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaPorPagar" ADD CONSTRAINT "CuentaPorPagar_gastosDEId_fkey" FOREIGN KEY ("gastosDEId") REFERENCES "GastosDE"("gastosDEId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaPorPagar" ADD CONSTRAINT "CuentaPorPagar_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Vendor"("vendorId") ON DELETE SET NULL ON UPDATE CASCADE;
