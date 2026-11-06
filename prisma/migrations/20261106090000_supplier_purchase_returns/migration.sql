ALTER TYPE "TipoOrigenMovimiento" ADD VALUE IF NOT EXISTS 'DEVOLUCION_COMPRA';

CREATE UNIQUE INDEX "Vendor_tenantId_vendorId_key"
ON "Vendor"("tenantId", "vendorId");

CREATE UNIQUE INDEX "CompraDocumento_tenantId_compraDocumentoId_key"
ON "CompraDocumento"("tenantId", "compraDocumentoId");

CREATE TABLE "devoluciones_compra" (
    "devolucionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "compraDocumentoId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "formaImputacion" TEXT NOT NULL,
    "motivo" TEXT,
    "montoTotal" INTEGER NOT NULL,
    "montoImputado" INTEGER NOT NULL DEFAULT 0,
    "montoImputadoFuncional" DECIMAL(20,4),
    "saldoAFavor" INTEGER NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'CUP',
    "idempotencyKey" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "completadaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "devoluciones_compra_pkey" PRIMARY KEY ("devolucionId")
);

CREATE TABLE "devoluciones_compra_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "devolucionId" TEXT NOT NULL,
    "compraDocumentoItemId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costoUnitario" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    CONSTRAINT "devoluciones_compra_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "devoluciones_compra_tenantId_devolucionId_key"
ON "devoluciones_compra"("tenantId", "devolucionId");
CREATE UNIQUE INDEX "devoluciones_compra_tenantId_numero_key"
ON "devoluciones_compra"("tenantId", "numero");
CREATE UNIQUE INDEX "devoluciones_compra_tenantId_idempotencyKey_key"
ON "devoluciones_compra"("tenantId", "idempotencyKey");
CREATE INDEX "devoluciones_compra_tenantId_compraDocumentoId_idx"
ON "devoluciones_compra"("tenantId", "compraDocumentoId");
CREATE INDEX "devoluciones_compra_tenantId_proveedorId_idx"
ON "devoluciones_compra"("tenantId", "proveedorId");

CREATE UNIQUE INDEX "devoluciones_compra_items_devolucionId_compraDocumentoItemId_key"
ON "devoluciones_compra_items"("devolucionId", "compraDocumentoItemId");
CREATE INDEX "devoluciones_compra_items_tenantId_compraDocumentoItemId_idx"
ON "devoluciones_compra_items"("tenantId", "compraDocumentoItemId");

ALTER TABLE "devoluciones_compra"
ADD CONSTRAINT "devoluciones_compra_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "devoluciones_compra"
ADD CONSTRAINT "devoluciones_compra_tenantId_compraDocumentoId_fkey"
FOREIGN KEY ("tenantId", "compraDocumentoId")
REFERENCES "CompraDocumento"("tenantId", "compraDocumentoId")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "devoluciones_compra"
ADD CONSTRAINT "devoluciones_compra_tenantId_proveedorId_fkey"
FOREIGN KEY ("tenantId", "proveedorId") REFERENCES "Vendor"("tenantId", "vendorId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "devoluciones_compra_items"
ADD CONSTRAINT "devoluciones_compra_items_tenantId_devolucionId_fkey"
FOREIGN KEY ("tenantId", "devolucionId")
REFERENCES "devoluciones_compra"("tenantId", "devolucionId")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "devoluciones_compra_items"
ADD CONSTRAINT "devoluciones_compra_items_tenantId_compraDocumentoItemId_fkey"
FOREIGN KEY ("tenantId", "compraDocumentoItemId")
REFERENCES "CompraDocumentoItem"("tenantId", "compraDocumentoItemId")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "devoluciones_compra_items"
ADD CONSTRAINT "devoluciones_compra_items_tenantId_productoId_fkey"
FOREIGN KEY ("tenantId", "productoId") REFERENCES "Producto"("tenantId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;
