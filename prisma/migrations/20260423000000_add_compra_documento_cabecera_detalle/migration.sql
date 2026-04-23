-- AlterTable: Add soft delete and audit fields to CompraProducto
ALTER TABLE "CompraProducto" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "CompraProducto" ADD COLUMN "updatedById" TEXT;
CREATE INDEX "CompraProducto_deletedAt_idx" ON "CompraProducto"("deletedAt");

-- AlterTable: Add soft delete to GastoCompra
ALTER TABLE "GastoCompra" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable: Add soft delete to CuentaPorPagar
ALTER TABLE "CuentaPorPagar" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "CuentaPorPagar_deletedAt_idx" ON "CuentaPorPagar"("deletedAt");

-- CreateTable: CompraDocumento (cabecera de compra múltiple)
CREATE TABLE "CompraDocumento" (
    "compraDocumentoId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "numeroFactura" TEXT NOT NULL DEFAULT '',
    "facturaUrl" TEXT NOT NULL DEFAULT '',
    "formaPago" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "tipoOperacion" TEXT NOT NULL DEFAULT 'REGULAR',
    "descripcion" TEXT,
    "fechaCompra" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" INTEGER NOT NULL DEFAULT 0,
    "gastoCompraId" TEXT,
    "cuentaPorPagarId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompraDocumento_pkey" PRIMARY KEY ("compraDocumentoId")
);

-- CreateTable: CompraDocumentoItem (líneas de detalle)
CREATE TABLE "CompraDocumentoItem" (
    "compraDocumentoItemId" TEXT NOT NULL,
    "compraDocumentoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" INTEGER NOT NULL,
    "totalLinea" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompraDocumentoItem_pkey" PRIMARY KEY ("compraDocumentoItemId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompraDocumento_gastoCompraId_key" ON "CompraDocumento"("gastoCompraId");
CREATE UNIQUE INDEX "CompraDocumento_cuentaPorPagarId_key" ON "CompraDocumento"("cuentaPorPagarId");
CREATE INDEX "CompraDocumento_estado_idx" ON "CompraDocumento"("estado");
CREATE INDEX "CompraDocumento_proveedorId_idx" ON "CompraDocumento"("proveedorId");
CREATE INDEX "CompraDocumento_fechaCompra_idx" ON "CompraDocumento"("fechaCompra");
CREATE INDEX "CompraDocumento_deletedAt_idx" ON "CompraDocumento"("deletedAt");
CREATE INDEX "CompraDocumentoItem_compraDocumentoId_idx" ON "CompraDocumentoItem"("compraDocumentoId");
CREATE INDEX "CompraDocumentoItem_productoId_idx" ON "CompraDocumentoItem"("productoId");

-- AddForeignKey
ALTER TABLE "CompraDocumento" ADD CONSTRAINT "CompraDocumento_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Vendor"("vendorId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompraDocumento" ADD CONSTRAINT "CompraDocumento_gastoCompraId_fkey" FOREIGN KEY ("gastoCompraId") REFERENCES "GastoCompra"("gastoCompraId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompraDocumento" ADD CONSTRAINT "CompraDocumento_cuentaPorPagarId_fkey" FOREIGN KEY ("cuentaPorPagarId") REFERENCES "CuentaPorPagar"("cuentaPorPagarId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompraDocumento" ADD CONSTRAINT "CompraDocumento_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompraDocumentoItem" ADD CONSTRAINT "CompraDocumentoItem_compraDocumentoId_fkey" FOREIGN KEY ("compraDocumentoId") REFERENCES "CompraDocumento"("compraDocumentoId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompraDocumentoItem" ADD CONSTRAINT "CompraDocumentoItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
