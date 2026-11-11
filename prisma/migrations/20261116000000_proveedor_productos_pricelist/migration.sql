CREATE TABLE "proveedor_productos" (
    "proveedorProductoId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "costoUnitario" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'CUP',
    "cantidadMinima" INTEGER,
    "plazoEntregaDias" INTEGER,
    "esPreferente" BOOLEAN NOT NULL DEFAULT false,
    "ultimaCompraDocumentoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "proveedor_productos_pkey" PRIMARY KEY ("proveedorProductoId")
);

CREATE UNIQUE INDEX "proveedor_productos_tenantId_vendorId_productoId_key"
    ON "proveedor_productos"("tenantId", "vendorId", "productoId");
CREATE INDEX "proveedor_productos_tenantId_productoId_idx"
    ON "proveedor_productos"("tenantId", "productoId");

ALTER TABLE "proveedor_productos" ADD CONSTRAINT "proveedor_productos_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "proveedor_productos" ADD CONSTRAINT "proveedor_productos_vendorId_fkey"
    FOREIGN KEY ("tenantId", "vendorId") REFERENCES "Vendor"("tenantId", "vendorId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "proveedor_productos" ADD CONSTRAINT "proveedor_productos_productoId_fkey"
    FOREIGN KEY ("tenantId", "productoId") REFERENCES "Producto"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "proveedor_productos" ADD CONSTRAINT "proveedor_productos_ultimaCompraDocumentoId_fkey"
    FOREIGN KEY ("tenantId", "ultimaCompraDocumentoId") REFERENCES "CompraDocumento"("tenantId", "compraDocumentoId") ON DELETE RESTRICT ON UPDATE CASCADE;
