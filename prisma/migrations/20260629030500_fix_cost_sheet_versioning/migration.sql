BEGIN;

-- Allow full template history per product while keeping a single active version.
DROP INDEX IF EXISTS "ProductoCostSheetTemplate_productoId_esActiva_key";

CREATE UNIQUE INDEX "ProductoCostSheetTemplate_productoId_version_key"
ON "ProductoCostSheetTemplate"("productoId", "version");

CREATE UNIQUE INDEX "ProductoCostSheetTemplate_productoId_active_key"
ON "ProductoCostSheetTemplate"("productoId")
WHERE "esActiva" = true;

COMMIT;
