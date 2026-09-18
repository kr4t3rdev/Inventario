-- Órdenes de compra, recepciones parciales y reglas min/max.
ALTER TABLE "CompraDocumento" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "CompraDocumento" document
SET "tenantId" = vendor."tenantId"
FROM "Vendor" vendor
WHERE document."proveedorId" = vendor."vendorId"
  AND document."tenantId" IS NULL;
ALTER TABLE "CompraDocumento" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CompraDocumento" ADD CONSTRAINT "CompraDocumento_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "CompraDocumento_tenantId_idx" ON "CompraDocumento"("tenantId");

ALTER TABLE "CompraDocumentoItem" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
UPDATE "CompraDocumentoItem" item
SET "tenantId" = document."tenantId"
FROM "CompraDocumento" document
WHERE item."compraDocumentoId" = document."compraDocumentoId"
  AND item."tenantId" IS NULL;
ALTER TABLE "CompraDocumentoItem" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CompraDocumentoItem" ADD CONSTRAINT "CompraDocumentoItem_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "CompraDocumentoItem_tenantId_idx" ON "CompraDocumentoItem"("tenantId");

ALTER TABLE "CompraDocumento" ADD COLUMN "ordenCompraId" TEXT;
CREATE INDEX "CompraDocumento_tenantId_ordenCompraId_idx"
  ON "CompraDocumento"("tenantId", "ordenCompraId");

CREATE TABLE "OrdenCompra" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "total" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrdenCompra_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrdenCompraItem" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidadPedida" INTEGER NOT NULL,
    "cantidadRecibida" INTEGER NOT NULL DEFAULT 0,
    "precioUnitario" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrdenCompraItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Recepcion" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" TEXT,
    CONSTRAINT "Recepcion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecepcionItem" (
    "id" TEXT NOT NULL,
    "recepcionId" TEXT NOT NULL,
    "ordenItemId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    CONSTRAINT "RecepcionItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReglaReabastecimiento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "tipoUbicacion" TEXT NOT NULL DEFAULT 'almacen',
    "ubicacionId" TEXT NOT NULL,
    "min" INTEGER NOT NULL,
    "max" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReglaReabastecimiento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReglaReabastecimiento_tenantId_productoId_tipoUbicacion_ubicacionId_key"
  ON "ReglaReabastecimiento"("tenantId", "productoId", "tipoUbicacion", "ubicacionId");
CREATE INDEX "OrdenCompra_tenantId_estado_idx" ON "OrdenCompra"("tenantId", "estado");
CREATE INDEX "OrdenCompra_tenantId_proveedorId_idx" ON "OrdenCompra"("tenantId", "proveedorId");
CREATE INDEX "OrdenCompraItem_tenantId_ordenId_idx" ON "OrdenCompraItem"("tenantId", "ordenId");
CREATE INDEX "OrdenCompraItem_tenantId_productoId_idx" ON "OrdenCompraItem"("tenantId", "productoId");
CREATE INDEX "Recepcion_tenantId_ordenId_idx" ON "Recepcion"("tenantId", "ordenId");
CREATE INDEX "RecepcionItem_tenantId_recepcionId_idx" ON "RecepcionItem"("tenantId", "recepcionId");
CREATE INDEX "RecepcionItem_tenantId_ordenItemId_idx" ON "RecepcionItem"("tenantId", "ordenItemId");
CREATE INDEX "ReglaReabastecimiento_tenantId_ubicacionId_idx"
  ON "ReglaReabastecimiento"("tenantId", "ubicacionId");

ALTER TABLE "CompraDocumento"
  ADD CONSTRAINT "CompraDocumento_ordenCompraId_fkey"
  FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrdenCompra"
  ADD CONSTRAINT "OrdenCompra_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrdenCompra"
  ADD CONSTRAINT "OrdenCompra_proveedorId_fkey"
  FOREIGN KEY ("proveedorId") REFERENCES "Vendor"("vendorId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrdenCompraItem"
  ADD CONSTRAINT "OrdenCompraItem_ordenId_fkey"
  FOREIGN KEY ("ordenId") REFERENCES "OrdenCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrdenCompraItem"
  ADD CONSTRAINT "OrdenCompraItem_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrdenCompraItem"
  ADD CONSTRAINT "OrdenCompraItem_productoId_fkey"
  FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Recepcion"
  ADD CONSTRAINT "Recepcion_ordenId_fkey"
  FOREIGN KEY ("ordenId") REFERENCES "OrdenCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recepcion"
  ADD CONSTRAINT "Recepcion_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecepcionItem"
  ADD CONSTRAINT "RecepcionItem_recepcionId_fkey"
  FOREIGN KEY ("recepcionId") REFERENCES "Recepcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecepcionItem"
  ADD CONSTRAINT "RecepcionItem_ordenItemId_fkey"
  FOREIGN KEY ("ordenItemId") REFERENCES "OrdenCompraItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecepcionItem"
  ADD CONSTRAINT "RecepcionItem_productoId_fkey"
  FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecepcionItem"
  ADD CONSTRAINT "RecepcionItem_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReglaReabastecimiento"
  ADD CONSTRAINT "ReglaReabastecimiento_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReglaReabastecimiento"
  ADD CONSTRAINT "ReglaReabastecimiento_productoId_fkey"
  FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
