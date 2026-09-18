-- Normalize databases that applied either historical StockUbicacion shape.
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

ALTER TABLE "StockUbicacion"
    ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

UPDATE "StockUbicacion" AS stock
SET "tenantId" = producto."tenantId"
FROM "Producto" AS producto
WHERE stock."tenantId" IS NULL
  AND producto."id" = stock."productoId";

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "StockUbicacion"
        WHERE "tenantId" IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot backfill StockUbicacion.tenantId: rows without a matching Producto remain';
    END IF;
END $$;

ALTER TABLE "StockUbicacion"
    ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "StockUbicacion_tenantId_idx"
    ON "StockUbicacion"("tenantId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'StockUbicacion_tenantId_fkey'
          AND conrelid = '"StockUbicacion"'::regclass
    ) THEN
        ALTER TABLE "StockUbicacion"
            ADD CONSTRAINT "StockUbicacion_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Remove indexes from the older table shape that are not part of the current
-- Prisma schema. The canonical indexes are created defensively below.
DROP INDEX IF EXISTS "StockUbicacion_tipoUbicacion_ubicacionId_idx";
DROP INDEX IF EXISTS "StockUbicacion_ubicacionId_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "StockUbicacion_productoId_tipoUbicacion_ubicacionId_key"
    ON "StockUbicacion"("productoId", "tipoUbicacion", "ubicacionId");
CREATE INDEX IF NOT EXISTS "StockUbicacion_ubicacionId_tipoUbicacion_idx"
    ON "StockUbicacion"("ubicacionId", "tipoUbicacion");
CREATE INDEX IF NOT EXISTS "StockUbicacion_productoId_idx"
    ON "StockUbicacion"("productoId");
