-- Kardex inmutable por tenant, producto y ubicación.
-- Idempotencia: clave única de evento (secuencia distingue salida/entrada y compensaciones).
-- Retención: producto ON DELETE RESTRICT (el ledger no se borra con el producto).
-- Integridad multi-tenant: FK compuesta (productoTenantId, productoId) -> Producto(tenantId, id).

CREATE TYPE "TipoOrigenMovimiento" AS ENUM (
    'VENTA', 'COMPRA', 'TRANSFERENCIA', 'MERMA', 'AJUSTE', 'PRODUCCION', 'CONTEO'
);

CREATE TABLE "StockMoveLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productoTenantId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "tipoOrigen" "TipoOrigenMovimiento" NOT NULL,
    "origenId" TEXT NOT NULL,
    "tipoUbicacion" TEXT NOT NULL,
    "ubicacionId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costoUnitario" INTEGER NOT NULL,
    "costoTotal" INTEGER NOT NULL,
    "secuencia" TEXT NOT NULL DEFAULT '0',
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMoveLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockMoveLine_eventoKey_key"
    ON "StockMoveLine"("tenantId", "tipoOrigen", "origenId", "productoId", "tipoUbicacion", "ubicacionId", "secuencia");
CREATE INDEX "StockMoveLine_tenantId_productoId_createdAt_idx"
    ON "StockMoveLine"("tenantId", "productoId", "createdAt");
CREATE INDEX "StockMoveLine_tenantId_tipoOrigen_origenId_idx"
    ON "StockMoveLine"("tenantId", "tipoOrigen", "origenId");
CREATE INDEX "StockMoveLine_tenantId_ubicacionId_createdAt_id_idx"
    ON "StockMoveLine"("tenantId", "ubicacionId", "createdAt", "id");

-- Soporte de FK compuesta tenant+producto.
CREATE UNIQUE INDEX "Producto_tenantId_id_key" ON "Producto"("tenantId", "id");

ALTER TABLE "StockMoveLine"
    ADD CONSTRAINT "StockMoveLine_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockMoveLine"
    ADD CONSTRAINT "StockMoveLine_productoTenantId_productoId_fkey"
    FOREIGN KEY ("productoTenantId", "productoId") REFERENCES "Producto"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockMoveLine"
    ADD CONSTRAINT "StockMoveLine_creadoPorId_fkey"
    FOREIGN KEY ("creadoPorId") REFERENCES "User"("userId")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- El kardex es apendicular: prohibir UPDATE/DELETE a nivel de base de datos.
CREATE OR REPLACE FUNCTION stock_move_line_inmutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'StockMoveLine es apendicular: no se permite %; registre un movimiento compensatorio', TG_OP;
END;
$$;

CREATE TRIGGER "stock_move_line_no_update"
    BEFORE UPDATE ON "StockMoveLine"
    FOR EACH ROW EXECUTE FUNCTION stock_move_line_inmutable();

CREATE TRIGGER "stock_move_line_no_delete"
    BEFORE DELETE ON "StockMoveLine"
    FOR EACH ROW EXECUTE FUNCTION stock_move_line_inmutable();
