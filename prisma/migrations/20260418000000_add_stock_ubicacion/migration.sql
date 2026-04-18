-- CreateTable StockUbicacion
CREATE TABLE "StockUbicacion" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "tipoUbicacion" TEXT NOT NULL,
    "ubicacionId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,
    "cantidadReservada" INTEGER NOT NULL DEFAULT 0,
    "cantidadDisponible" INTEGER NOT NULL DEFAULT 0,
    "ultimaActualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockUbicacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockUbicacion_productoId_tipoUbicacion_ubicacionId_key" ON "StockUbicacion"("productoId", "tipoUbicacion", "ubicacionId");

-- CreateIndex
CREATE INDEX "StockUbicacion_ubicacionId_tipoUbicacion_idx" ON "StockUbicacion"("ubicacionId", "tipoUbicacion");

-- CreateIndex
CREATE INDEX "StockUbicacion_productoId_idx" ON "StockUbicacion"("productoId");

-- AddForeignKey
ALTER TABLE "StockUbicacion" ADD CONSTRAINT "StockUbicacion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateIndex
CREATE UNIQUE INDEX "StockUbicacion_productoId_tipoUbicacion_ubicacionId_key" ON "StockUbicacion"("productoId", "tipoUbicacion", "ubicacionId");

-- CreateIndex
CREATE INDEX "StockUbicacion_ubicacionId_tipoUbicacion_idx" ON "StockUbicacion"("ubicacionId", "tipoUbicacion");

-- CreateIndex
CREATE INDEX "StockUbicacion_productoId_idx" ON "StockUbicacion"("productoId");

-- AddForeignKey
ALTER TABLE "StockUbicacion" ADD CONSTRAINT "StockUbicacion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
