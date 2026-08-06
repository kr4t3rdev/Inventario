-- Tenant scoping para GastoConcepto y GastoElemento.
--
-- Los conceptos y elementos eran un catálogo global compartido por todos los
-- tenants. Esta migración:
--   1. Agrega tenantId (nullable primero, hay datos globales que migrar).
--   2. Clona el catálogo global por cada tenant que tenga GastosDE
--      referenciando conceptos/elementos (IDs deterministas).
--   3. Remapea GastosDE.conceptoId/elementoId a las copias del tenant.
--   4. Elimina los registros globales huérfanos.
--   5. Aplica NOT NULL, índices, unicidad por tenant y FKs.

-- El índice único global sobre nombre impide insertar las copias (mismo
-- nombre) mientras exista; se elimina primero.
DROP INDEX "GastoConcepto_nombre_key";

-- 1) Columnas tenantId nullable
ALTER TABLE "GastoConcepto" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "GastoElemento" ADD COLUMN     "tenantId" TEXT;

-- 2) Clonar el catálogo por tenant
DO $$
DECLARE
  t TEXT;
  c RECORD;
  e RECORD;
  new_concepto_id TEXT;
  new_elemento_id TEXT;
BEGIN
  FOR t IN
    SELECT DISTINCT "tenantId" FROM "GastosDE"
    WHERE "conceptoId" IS NOT NULL OR "elementoId" IS NOT NULL
  LOOP
    -- Solo los conceptos globales originales; las copias ya llevan tenantId
    -- asignado y quedarían fuera del cursor (misma transacción ve sus cambios).
    FOR c IN SELECT * FROM "GastoConcepto" WHERE "tenantId" IS NULL
    LOOP
      new_concepto_id := 'gc-clone-' || md5(c."conceptoId" || ':' || t);
      IF NOT EXISTS (SELECT 1 FROM "GastoConcepto" WHERE "conceptoId" = new_concepto_id) THEN
        INSERT INTO "GastoConcepto" ("conceptoId", "tenantId", "nombre", "descripcion", "isActive", "createdAt", "updatedAt")
        VALUES (new_concepto_id, t, c."nombre", c."descripcion", c."isActive", c."createdAt", c."updatedAt");

        FOR e IN SELECT * FROM "GastoElemento" WHERE "conceptoId" = c."conceptoId" AND "tenantId" IS NULL
        LOOP
          new_elemento_id := 'ge-clone-' || md5(e."elementoId" || ':' || t);
          INSERT INTO "GastoElemento" ("elementoId", "tenantId", "conceptoId", "nombre", "descripcion", "isActive", "createdAt", "updatedAt")
          VALUES (new_elemento_id, t, new_concepto_id, e."nombre", e."descripcion", e."isActive", e."createdAt", e."updatedAt");
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 3) Remapear GastosDE a las copias del tenant (misma función determinista)
UPDATE "GastosDE" g
SET "conceptoId" = 'gc-clone-' || md5(g."conceptoId" || ':' || g."tenantId"),
    "elementoId" = 'ge-clone-' || md5(g."elementoId" || ':' || g."tenantId")
WHERE g."conceptoId" IS NOT NULL OR g."elementoId" IS NOT NULL;

-- 4) Eliminar catálogo global huérfano (elementos antes que conceptos)
DELETE FROM "GastoElemento" WHERE "tenantId" IS NULL;
DELETE FROM "GastoConcepto" WHERE "tenantId" IS NULL;

-- 5) Constraints, índices y FKs
ALTER TABLE "GastoConcepto" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "GastoElemento" ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX "GastoConcepto_tenantId_idx" ON "GastoConcepto"("tenantId");
CREATE UNIQUE INDEX "GastoConcepto_tenantId_nombre_key" ON "GastoConcepto"("tenantId", "nombre");
CREATE INDEX "GastoElemento_tenantId_idx" ON "GastoElemento"("tenantId");
CREATE UNIQUE INDEX "GastoElemento_tenantId_conceptoId_nombre_key" ON "GastoElemento"("tenantId", "conceptoId", "nombre");

ALTER TABLE "GastoConcepto" ADD CONSTRAINT "GastoConcepto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GastoElemento" ADD CONSTRAINT "GastoElemento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
