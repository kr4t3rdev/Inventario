-- Historical compatibility: an earlier migration may already have created this
-- table with "stockId" as its primary key. Create it only when absent, then
-- normalize that earlier shape without discarding data.
CREATE TABLE IF NOT EXISTS "StockUbicacion" (
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

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'StockUbicacion'
          AND column_name = 'stockId'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'StockUbicacion'
          AND column_name = 'id'
    ) THEN
        ALTER TABLE "StockUbicacion" RENAME COLUMN "stockId" TO "id";
    END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StockUbicacion_productoId_tipoUbicacion_ubicacionId_key" ON "StockUbicacion"("productoId", "tipoUbicacion", "ubicacionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockUbicacion_ubicacionId_tipoUbicacion_idx" ON "StockUbicacion"("ubicacionId", "tipoUbicacion");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockUbicacion_productoId_idx" ON "StockUbicacion"("productoId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'StockUbicacion_productoId_fkey'
          AND conrelid = '"StockUbicacion"'::regclass
    ) THEN
        ALTER TABLE "StockUbicacion"
            ADD CONSTRAINT "StockUbicacion_productoId_fkey"
            FOREIGN KEY ("productoId") REFERENCES "Producto"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
