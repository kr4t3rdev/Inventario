-- Script para asignar códigos de proveedor automáticamente
-- Ejecutar en la base de datos PostgreSQL

-- 1. Ver proveedores sin código
SELECT vendorId, nombre, proveedorCodigo, createdAt 
FROM "Vendor" 
WHERE proveedorCodigo IS NULL
ORDER BY createdAt;

-- 2. Asignar códigos secuenciales
-- Este script actualiza uno por uno
DO $$
DECLARE 
  vendor RECORD;
  counter INTEGER := 0;
  code TEXT;
BEGIN
  -- Obtener proveedores sin código ordenados por fecha
  FOR vendor IN 
    SELECT vendorId, createdAt 
    FROM "Vendor" 
    WHERE proveedorCodigo IS NULL
    ORDER BY createdAt
  LOOP
    -- Calcular código
    IF counter < 10 THEN
      code := '0' || counter;
    ELSIF counter < 100 THEN
      code := counter::TEXT;
    ELSIF counter < 136 THEN  -- 10-35 = A-Z (26 letras)
      code := CHR(65 + counter - 100) || '0';
    ELSIF counter < 172 THEN -- 36-71 = A[0-9]Z (36 combos)
      code := 'A' || CHR(48 + counter - 136);
    ELSIF counter < 208 THEN
      code := 'B' || CHR(48 + counter - 172);
    ELSIF counter < 244 THEN
      code := 'C' || CHR(48 + counter - 208);
    ELSE
      code := 'ZZ'; -- Máximo
    END IF;
    
    -- Actualizar
    UPDATE "Vendor" 
    SET proveedorCodigo = code 
    WHERE vendorId = vendor.vendorId;
    
    counter := counter + 1;
  END LOOP;
  
  RAISE NOTICE 'Se asignaron códigos a % proveedores', counter;
END $$;

-- 3. Verificar resultados
SELECT vendorId, nombre, proveedorCodigo 
FROM "Vendor" 
ORDER BY proveedorCodigo;
