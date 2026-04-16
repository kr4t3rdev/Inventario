-- =====================================================
-- MIGRATION SCRIPT: Contrato Tipos y Consecutivos
-- Fecha: 15 de abril de 2026
-- Descripción: Asigna números consecutivos a contratos 
--              existentes después de cambiar tipos
-- =====================================================

-- STEP 1: Asignar numeroConsecutivo a COMPRA_VENTA (conversión de VENTA)
-- Este UPDATE utiliza ROW_NUMBER para asignar secuencias ordenadas por createdAt
UPDATE "Contrato" c
SET "numeroConsecutivo" = subquery.rn
FROM (
  SELECT "contratoId", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as rn
  FROM "Contrato"
  WHERE "tipo" = 'COMPRA_VENTA'
) subquery
WHERE c."contratoId" = subquery."contratoId"
  AND c."tipo" = 'COMPRA_VENTA';

-- STEP 2: Asignar numeroConsecutivo a SERVICIO (sin cambio de tipo, pero necesita consecutivo)
UPDATE "Contrato" c
SET "numeroConsecutivo" = subquery.rn
FROM (
  SELECT "contratoId", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as rn
  FROM "Contrato"
  WHERE "tipo" = 'SERVICIO'
) subquery
WHERE c."contratoId" = subquery."contratoId"
  AND c."tipo" = 'SERVICIO';

-- STEP 3: Asignar numeroConsecutivo a SUMINISTROS (conversión de PROVEEDOR)
UPDATE "Contrato" c
SET "numeroConsecutivo" = subquery.rn
FROM (
  SELECT "contratoId", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as rn
  FROM "Contrato"
  WHERE "tipo" = 'SUMINISTROS'
) subquery
WHERE c."contratoId" = subquery."contratoId"
  AND c."tipo" = 'SUMINISTROS';

-- STEP 4: Validación - Verificar que todos los contratos tienen numeroConsecutivo
SELECT COUNT(*) as "ContratosConConsecutivo"
FROM "Contrato"
WHERE "numeroConsecutivo" IS NOT NULL;

-- STEP 5: Validación - Verificar la distribución por tipo
SELECT 
  "tipo", 
  COUNT(*) as "CantidadPorTipo",
  MAX("numeroConsecutivo") as "ÚltimoConsecutivo"
FROM "Contrato"
WHERE "numeroConsecutivo" IS NOT NULL
GROUP BY "tipo"
ORDER BY "tipo";

-- STEP 6: Validación - Verificar que no hay duplicados (tipo, numeroConsecutivo)
SELECT "tipo", "numeroConsecutivo", COUNT(*) as "Duplicados"
FROM "Contrato"
WHERE "numeroConsecutivo" IS NOT NULL
GROUP BY "tipo", "numeroConsecutivo"
HAVING COUNT(*) > 1;

-- Si la query anterior NO retorna filas, todo está correcto ✓

-- =====================================================
-- NOTAS IMPORTANTES:
-- =====================================================
-- 1. Este script es IDEMPOTENTE pero ejecutar varias veces
--    podría reasignar los numeroConsecutivo. Ejecutar UNA SOLA VEZ.
--
-- 2. El campo numeroContratoClienteProveedor quedar vacío (NULL)
--    hasta que se llene manualmente o vía formulario.
--
-- 3. Los números históricos en "numeroContrato" se mantienen intactos.
--    Ej: Si existía "CV-2024-001", se mantiene así.
--
-- 4. Los nuevos contratos creados después de esta migración
--    se auto-generarán con formato nuevo: CV-0001, SER-0001, SUM-0001
--
-- 5. Para ROLLBACK en caso de error:
--    UPDATE "Contrato" SET "numeroConsecutivo" = 1, "numeroContratoClienteProveedor" = NULL
--
-- =====================================================
