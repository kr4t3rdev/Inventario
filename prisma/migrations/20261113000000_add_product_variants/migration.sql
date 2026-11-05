CREATE TABLE "producto_plantillas" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "atributos" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "producto_plantillas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductoPlantilla_tenant_id_key" UNIQUE ("tenantId", "id"),
  CONSTRAINT "producto_plantillas_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "producto_plantillas_tenantId_nombre_idx"
  ON "producto_plantillas"("tenantId", "nombre");

ALTER TABLE "Producto"
  ADD COLUMN "plantillaId" TEXT,
  ADD COLUMN "atributoJson" JSONB,
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "esVariante" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Producto_tenant_sku_key" ON "Producto"("tenantId", "sku");

ALTER TABLE "Producto"
  ADD CONSTRAINT "Producto_plantilla_tenant_fkey"
    FOREIGN KEY ("tenantId", "plantillaId")
    REFERENCES "producto_plantillas"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Producto_variant_fields_check"
    CHECK (
      (NOT "esVariante" AND "plantillaId" IS NULL AND "atributoJson" IS NULL)
      OR (
        "esVariante"
        AND "plantillaId" IS NOT NULL
        AND "atributoJson" IS NOT NULL
        AND "sku" IS NOT NULL
      )
    );
