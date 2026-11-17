CREATE UNIQUE INDEX "Lote_tenantId_id_productoId_key" ON "Lote"("tenantId", "id", "productoId");

CREATE TABLE "inventario_inicial_fuentes" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "inicializacionId" TEXT NOT NULL,
  "loteId" TEXT NOT NULL,
  "productoId" TEXT NOT NULL,
  "cantidad" INTEGER NOT NULL CHECK ("cantidad" > 0),
  "costoUnitario" INTEGER NOT NULL CHECK ("costoUnitario" > 0),
  "moneda" TEXT NOT NULL CHECK ("moneda" ~ '^[A-Z]{3,8}$'),
  "fechaCorte" TIMESTAMP(3) NOT NULL,
  "montoFuncional" DECIMAL(20,4) NOT NULL CHECK ("montoFuncional" > 0),
  "monedaFuncional" TEXT NOT NULL CHECK ("monedaFuncional" ~ '^[A-Z]{3,8}$'),
  "evidencia" JSONB NOT NULL CHECK (jsonb_typeof("evidencia") = 'object'),
  "evidenciaHash" TEXT NOT NULL CHECK ("evidenciaHash" ~ '^[a-f0-9]{64}$'),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventario_inicial_fuentes_inicializacion_fkey"
    FOREIGN KEY ("tenantId", "inicializacionId")
    REFERENCES "inicializaciones_contables"("tenantId", "inicializacionId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventario_inicial_fuentes_lote_fkey"
    FOREIGN KEY ("tenantId", "loteId", "productoId")
    REFERENCES "Lote"("tenantId", "id", "productoId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "inventario_inicial_fuentes_tenantId_loteId_key"
  ON "inventario_inicial_fuentes"("tenantId", "loteId");
CREATE UNIQUE INDEX "inventario_inicial_fuentes_tenantId_id_loteId_key"
  ON "inventario_inicial_fuentes"("tenantId", "id", "loteId");
CREATE INDEX "inventario_inicial_fuentes_tenantId_inicializacionId_idx"
  ON "inventario_inicial_fuentes"("tenantId", "inicializacionId");

ALTER TABLE "purchase_allocations"
  ADD COLUMN "inventarioInicialFuenteId" TEXT,
  DROP CONSTRAINT "purchase_allocations_source_check",
  ADD CONSTRAINT "purchase_allocations_source_check" CHECK (
    ("compraDocumentoItemId" IS NOT NULL AND "recepcionItemId" IS NULL AND "inventarioInicialFuenteId" IS NULL)
    OR ("compraDocumentoItemId" IS NULL AND "recepcionItemId" IS NOT NULL AND "loteId" IS NOT NULL AND "inventarioInicialFuenteId" IS NULL)
    OR ("compraDocumentoItemId" IS NULL AND "recepcionItemId" IS NULL AND "loteId" IS NOT NULL AND "inventarioInicialFuenteId" IS NOT NULL AND "purchaseReceiptInvoiceAllocationId" IS NULL)
  ),
  ADD CONSTRAINT "purchase_allocations_inventario_inicial_fkey"
    FOREIGN KEY ("tenantId", "inventarioInicialFuenteId", "loteId")
    REFERENCES "inventario_inicial_fuentes"("tenantId", "id", "loteId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "purchase_allocations_tenantId_inventarioInicialFuenteId_idx"
  ON "purchase_allocations"("tenantId", "inventarioInicialFuenteId");
