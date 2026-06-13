-- Migración: unidad-tenant-scoping-and-restrict
-- Paso 1: Agregar tenantId como nullable
ALTER TABLE "Unidad" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- Paso 2: Eliminar constraints viejos ANTES de insertar duplicados
ALTER TABLE "Unidad" DROP CONSTRAINT IF EXISTS "Unidad_nombre_key";
ALTER TABLE "Unidad" DROP CONSTRAINT IF EXISTS "Unidad_simbolo_key";

-- Paso 3: Asignar tenantId a unidades existentes (copia a todos los tenants)
DO $$
DECLARE
    tenant_record RECORD;
    unidad_record RECORD;
BEGIN
    FOR tenant_record IN SELECT "tenantId" FROM "tenants" LOOP
        FOR unidad_record IN SELECT "unidadId", "nombre", "simbolo", "createdAt", "updatedAt" FROM "Unidad" WHERE "tenantId" IS NULL LOOP
            -- Insertar copia para este tenant si no existe ya
            INSERT INTO "Unidad" ("unidadId", "tenantId", "nombre", "simbolo", "createdAt", "updatedAt")
            SELECT 
                ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
                tenant_record."tenantId",
                unidad_record."nombre",
                unidad_record."simbolo",
                unidad_record."createdAt",
                unidad_record."updatedAt"
            WHERE NOT EXISTS (
                SELECT 1 FROM "Unidad" u2 
                WHERE u2."tenantId" = tenant_record."tenantId" 
                AND u2."nombre" = unidad_record."nombre"
            );
        END LOOP;
    END LOOP;
    
    -- Eliminar registros sin tenantId (los originales sin tenant)
    DELETE FROM "Unidad" WHERE "tenantId" IS NULL;
END $$;

-- Paso 4: Hacer tenantId NOT NULL
ALTER TABLE "Unidad" ALTER COLUMN "tenantId" SET NOT NULL;

-- Paso 5: Agregar constraints de unicidad compuestos
ALTER TABLE "Unidad" ADD CONSTRAINT "Unidad_tenantId_nombre_key" UNIQUE ("tenantId", "nombre");
ALTER TABLE "Unidad" ADD CONSTRAINT "Unidad_tenantId_simbolo_key" UNIQUE ("tenantId", "simbolo");

-- Paso 6: Agregar índice
CREATE INDEX IF NOT EXISTS "Unidad_tenantId_idx" ON "Unidad"("tenantId");

-- Paso 7: Agregar FK a Tenant
ALTER TABLE "Unidad" ADD CONSTRAINT "Unidad_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Paso 8: Cambiar onDelete en Producto.unidad de Cascade a Restrict
ALTER TABLE "Producto" DROP CONSTRAINT IF EXISTS "Producto_unidadId_fkey";
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "Unidad"("unidadId") ON DELETE RESTRICT ON UPDATE CASCADE;
