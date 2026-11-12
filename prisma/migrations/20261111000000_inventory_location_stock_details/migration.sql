-- Preserva el saldo agregado existente y asigna su detalle a una hoja General.
INSERT INTO "Ubicacion" ("id", "tenantId", "almacenId", "parentId", "nombre", "tipo", "createdAt", "updatedAt")
SELECT 'legacy-zone-' || a."almacenId", a."tenantId", a."almacenId", NULL,
       'Área general', 'ZONA', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Almacen" a
ON CONFLICT ("tenantId", "almacenId", "id") DO NOTHING;

INSERT INTO "Ubicacion" ("id", "tenantId", "almacenId", "parentId", "nombre", "tipo", "createdAt", "updatedAt")
SELECT 'legacy-general-' || a."almacenId", a."tenantId", a."almacenId",
       'legacy-zone-' || a."almacenId", 'General', 'HOJA', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Almacen" a
ON CONFLICT ("tenantId", "almacenId", "id") DO NOTHING;

CREATE TABLE "StockUbicacionDetalle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "ubicacionHijaId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,
    "cantidadReservada" INTEGER NOT NULL DEFAULT 0,
    "cantidadDisponible" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockUbicacionDetalle_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StockUbicacionDetalle_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockUbicacionDetalle_producto_fkey"
      FOREIGN KEY ("tenantId", "productoId") REFERENCES "Producto"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockUbicacionDetalle_ubicacion_fkey"
      FOREIGN KEY ("tenantId", "almacenId", "ubicacionHijaId")
      REFERENCES "Ubicacion"("tenantId", "almacenId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockUbicacionDetalle_cantidad_check"
      CHECK ("cantidad" >= 0 AND "cantidadReservada" >= 0 AND "cantidadDisponible" >= 0)
);

CREATE UNIQUE INDEX "StockUbicacionDetalle_tenantId_productoId_ubicacionHijaId_key"
  ON "StockUbicacionDetalle"("tenantId", "productoId", "ubicacionHijaId");
CREATE INDEX "StockUbicacionDetalle_tenantId_almacenId_ubicacionHijaId_idx"
  ON "StockUbicacionDetalle"("tenantId", "almacenId", "ubicacionHijaId");
CREATE INDEX "StockUbicacionDetalle_tenantId_productoId_idx"
  ON "StockUbicacionDetalle"("tenantId", "productoId");

ALTER TABLE "StockMoveLine" ADD COLUMN "ubicacionHijaId" TEXT;
ALTER TABLE "StockMoveLine" ADD COLUMN "ubicacionHijaKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AjusteInventario" ADD COLUMN "ubicacionHijaId" TEXT;
ALTER TABLE "ConteoInventario" ADD COLUMN "ubicacionHijaId" TEXT;

-- Backfill sin modificar el saldo agregado existente.
INSERT INTO "StockUbicacionDetalle" (
  "id", "tenantId", "productoId", "almacenId", "ubicacionHijaId",
  "cantidad", "cantidadReservada", "cantidadDisponible", "createdAt", "updatedAt"
)
SELECT 'legacy-stock-' || su."id", su."tenantId", su."productoId", su."ubicacionId",
       'legacy-general-' || su."ubicacionId", su."cantidad", su."cantidadReservada",
       su."cantidadDisponible", su."createdAt", su."updatedAt"
FROM "StockUbicacion" su
JOIN "Almacen" a ON a."tenantId" = su."tenantId" AND a."almacenId" = su."ubicacionId"
WHERE su."tipoUbicacion" = 'almacen';

-- Backfill de ubicación: StockMoveLine es apendicular (triggers
-- stock_move_line_no_update/no_delete creados por 20260905130000_add_stock_move_lines),
-- se desactivan los triggers de usuario solo para este backfill puntual de legacy y se
-- reactivan inmediatamente después, dentro de la misma transacción de la migración.
ALTER TABLE "StockMoveLine" DISABLE TRIGGER USER;

UPDATE "StockMoveLine" sm
SET "ubicacionHijaId" = 'legacy-general-' || sm."ubicacionId",
    "ubicacionHijaKey" = 'legacy-general-' || sm."ubicacionId"
FROM "Almacen" a
WHERE sm."tenantId" = a."tenantId"
  AND sm."ubicacionId" = a."almacenId"
  AND sm."tipoUbicacion" = 'almacen';

ALTER TABLE "StockMoveLine" ENABLE TRIGGER USER;

UPDATE "AjusteInventario" ai
SET "ubicacionHijaId" = 'legacy-general-' || ai."ubicacionId"
FROM "Almacen" a
WHERE ai."tenantId" = a."tenantId"
  AND ai."ubicacionId" = a."almacenId"
  AND ai."tipoUbicacion" = 'almacen';

UPDATE "ConteoInventario" ci
SET "ubicacionHijaId" = 'legacy-general-' || ci."ubicacionId"
FROM "Almacen" a
WHERE ci."tenantId" = a."tenantId"
  AND ci."ubicacionId" = a."almacenId"
  AND ci."tipoUbicacion" = 'almacen';

-- La clave usa un string vacío para las ubicaciones sin hoja (punto de venta)
-- y el ID de la hoja para distinguir movimientos de almacén en una misma secuencia.
DROP INDEX "StockMoveLine_eventoKey_key";
CREATE UNIQUE INDEX "StockMoveLine_eventoKey_key"
  ON "StockMoveLine"(
    "tenantId", "tipoOrigen", "origenId", "productoId", "tipoUbicacion",
    "ubicacionId", "ubicacionHijaKey", "secuencia"
  );
CREATE INDEX "StockMoveLine_tenantId_ubicacionHijaId_createdAt_id_idx"
  ON "StockMoveLine"("tenantId", "ubicacionHijaId", "createdAt", "id");
CREATE INDEX "AjusteInventario_tenantId_ubicacionId_ubicacionHijaId_idx"
  ON "AjusteInventario"("tenantId", "ubicacionId", "ubicacionHijaId");
CREATE INDEX "ConteoInventario_tenantId_ubicacionHijaId_idx"
  ON "ConteoInventario"("tenantId", "ubicacionHijaId");

DO $$
DECLARE
  agregado BIGINT;
  detalle BIGINT;
BEGIN
  SELECT COALESCE(SUM(su."cantidad"), 0) INTO agregado
  FROM "StockUbicacion" su
  JOIN "Almacen" a ON a."tenantId" = su."tenantId" AND a."almacenId" = su."ubicacionId"
  WHERE su."tipoUbicacion" = 'almacen';
  SELECT COALESCE(SUM("cantidad"), 0) INTO detalle
  FROM "StockUbicacionDetalle";
  IF agregado <> detalle THEN
    RAISE EXCEPTION 'StockUbicacionDetalle backfill does not reconcile: agregado %, detalle %', agregado, detalle;
  END IF;
END $$;

-- Foreign keys for StockMoveLine, AjusteInventario, ConteoInventario
ALTER TABLE "StockMoveLine"
  ADD CONSTRAINT "StockMoveLine_ubicacionHija_fkey"
  FOREIGN KEY ("tenantId", "ubicacionId", "ubicacionHijaId")
  REFERENCES "Ubicacion"("tenantId", "almacenId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AjusteInventario"
  ADD CONSTRAINT "AjusteInventario_ubicacionHija_fkey"
  FOREIGN KEY ("tenantId", "ubicacionId", "ubicacionHijaId")
  REFERENCES "Ubicacion"("tenantId", "almacenId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConteoInventario"
  ADD CONSTRAINT "ConteoInventario_ubicacionHija_fkey"
  FOREIGN KEY ("tenantId", "ubicacionId", "ubicacionHijaId")
  REFERENCES "Ubicacion"("tenantId", "almacenId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
