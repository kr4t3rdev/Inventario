-- Lotes y ubicaciones jerárquicas para inventario Profesional.
CREATE UNIQUE INDEX "Almacen_tenantId_almacenId_key"
  ON "Almacen"("tenantId", "almacenId");
CREATE UNIQUE INDEX IF NOT EXISTS "CompraDocumentoItem_tenantId_compraDocumentoItemId_key"
  ON "CompraDocumentoItem"("tenantId", "compraDocumentoItemId");

CREATE TABLE "Lote" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productoId" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "fechaVencimiento" TIMESTAMP(3),
  "cantidadInicial" INTEGER NOT NULL,
  "cantidadDisponible" INTEGER NOT NULL,
  "compraItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ubicacion" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "almacenId" TEXT NOT NULL,
  "parentId" TEXT,
  "nombre" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ubicacion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "purchase_allocations" ADD COLUMN "loteId" TEXT;

CREATE UNIQUE INDEX "Lote_tenantId_id_key" ON "Lote"("tenantId", "id");
CREATE UNIQUE INDEX "Lote_tenantId_productoId_codigo_key"
  ON "Lote"("tenantId", "productoId", "codigo");
CREATE INDEX "Lote_tenantId_fechaVencimiento_idx"
  ON "Lote"("tenantId", "fechaVencimiento");
CREATE INDEX "Lote_tenantId_productoId_fechaVencimiento_idx"
  ON "Lote"("tenantId", "productoId", "fechaVencimiento");

CREATE UNIQUE INDEX "Ubicacion_tenantId_id_key" ON "Ubicacion"("tenantId", "id");
CREATE UNIQUE INDEX "Ubicacion_tenantId_almacenId_id_key"
  ON "Ubicacion"("tenantId", "almacenId", "id");
CREATE INDEX "Ubicacion_tenantId_almacenId_parentId_idx"
  ON "Ubicacion"("tenantId", "almacenId", "parentId");

CREATE INDEX "purchase_allocations_tenantId_loteId_idx"
  ON "purchase_allocations"("tenantId", "loteId");

ALTER TABLE "Lote"
  ADD CONSTRAINT "Lote_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Lote_tenantId_productoId_fkey"
    FOREIGN KEY ("tenantId", "productoId") REFERENCES "Producto"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Lote_tenantId_compraItemId_fkey"
    FOREIGN KEY ("tenantId", "compraItemId")
    REFERENCES "CompraDocumentoItem"("tenantId", "compraDocumentoItemId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Ubicacion"
  ADD CONSTRAINT "Ubicacion_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Ubicacion_tenantId_almacenId_fkey"
    FOREIGN KEY ("tenantId", "almacenId") REFERENCES "Almacen"("tenantId", "almacenId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Ubicacion_tenantId_almacenId_parentId_fkey"
    FOREIGN KEY ("tenantId", "almacenId", "parentId")
    REFERENCES "Ubicacion"("tenantId", "almacenId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_allocations"
  ADD CONSTRAINT "purchase_allocations_tenantId_loteId_fkey"
    FOREIGN KEY ("tenantId", "loteId") REFERENCES "Lote"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
