BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TYPE "CostChangeReason" AS ENUM (
  'INITIAL',
  'RESTOCK',
  'ADJUSTMENT',
  'CORRECTION',
  'IMPORT',
  'MANUAL_EDIT',
  'SYSTEM_SYNC'
);

CREATE TABLE "ProductoCostHistory" (
  "id" TEXT NOT NULL,
  "productoId" TEXT NOT NULL,
  "oldPrecioCosto" INTEGER NOT NULL,
  "newPrecioCosto" INTEGER NOT NULL,
  "oldPrecioVenta" INTEGER NOT NULL,
  "newPrecioVenta" INTEGER NOT NULL,
  "reason" "CostChangeReason" NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductoCostHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductoCostHistory_productoId_fkey"
    FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "VendorCodeSequence" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "nextNumber" INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "VendorCodeSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TipoContratoCustom" (
  "tipoCustomId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creadoPor" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TipoContratoCustom_pkey" PRIMARY KEY ("tipoCustomId"),
  CONSTRAINT "TipoContratoCustom_creadoPor_fkey"
    FOREIGN KEY ("creadoPor") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ProductoCostHistory_productoId_idx" ON "ProductoCostHistory"("productoId");
CREATE INDEX "ProductoCostHistory_changedAt_idx" ON "ProductoCostHistory"("changedAt");
CREATE INDEX "ProductoCostHistory_reason_idx" ON "ProductoCostHistory"("reason");
CREATE UNIQUE INDEX "TipoContratoCustom_nombre_key" ON "TipoContratoCustom"("nombre");
CREATE INDEX "TipoContratoCustom_nombre_idx" ON "TipoContratoCustom"("nombre");
CREATE INDEX "TipoContratoCustom_activo_idx" ON "TipoContratoCustom"("activo");

COMMIT;
