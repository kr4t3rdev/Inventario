BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TYPE "UnidadDimension" AS ENUM (
  'COUNT',
  'MASS',
  'VOLUME',
  'LENGTH',
  'AREA',
  'UNKNOWN'
);

ALTER TABLE "Unidad"
ADD COLUMN "dimension" "UnidadDimension" NOT NULL DEFAULT 'UNKNOWN';

CREATE UNIQUE INDEX "Unidad_tenantId_unidadId_key"
ON "Unidad"("tenantId", "unidadId");

CREATE UNIQUE INDEX "Producto_tenantId_id_unidadId_key"
ON "Producto"("tenantId", "id", "unidadId");

CREATE TABLE "UnidadConversion" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productoId" TEXT NOT NULL,
  "baseUnidadId" TEXT NOT NULL,
  "unidadId" TEXT NOT NULL,
  "factorAStock" DECIMAL(18, 8) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UnidadConversion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UnidadConversion_factorAStock_positive_check"
    CHECK ("factorAStock" <> 'NaN'::numeric AND "factorAStock" > 0),
  CONSTRAINT "UnidadConversion_same_unit_factor_identity_check"
    CHECK ("unidadId" <> "baseUnidadId" OR "factorAStock" = 1),
  CONSTRAINT "UnidadConversion_producto_base_fkey"
    FOREIGN KEY ("tenantId", "productoId", "baseUnidadId")
    REFERENCES "Producto"("tenantId", "id", "unidadId")
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT "UnidadConversion_unidad_tenant_fkey"
    FOREIGN KEY ("tenantId", "unidadId")
    REFERENCES "Unidad"("tenantId", "unidadId")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "UnidadConversion_tenantId_productoId_unidadId_key"
ON "UnidadConversion"("tenantId", "productoId", "unidadId");

CREATE INDEX "UnidadConversion_tenantId_productoId_baseUnidadId_idx"
ON "UnidadConversion"("tenantId", "productoId", "baseUnidadId");

COMMIT;
