-- CreateEnum
CREATE TYPE "FormaPagoCompra" AS ENUM ('PAGO_PARCIAL', 'PAGO_COMPLETO');

-- CreateEnum
CREATE TYPE "EstadoCompraProducto" AS ENUM ('PENDIENTE', 'PAGADA');

-- CreateEnum
CREATE TYPE "TipoOperacionCompra" AS ENUM ('RESTOCK', 'REGULAR');

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
