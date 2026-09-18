-- Propaga los flags de paridad de inventario a planes y licencias existentes.
-- El núcleo auditable (kardex/ajustes/conteo) se habilita en TODOS los planes;
-- el resto sigue el gate por plan (Profesional = P1, Empresarial = P1 + MRP).
-- Idempotente: `||` conserva claves existentes y el WHERE vuelve a correr sin daño.

-- 1. Núcleo auditable en todos los planes definidos.
UPDATE "Plan"
SET "features" = "features" || '{
  "kardex": true,
  "ajustes-inventario": true,
  "conteo-fisico": true
}'::jsonb
WHERE jsonb_typeof("features") = 'object';

-- 2. Flags P1 solo en planes pagos (Profesional y Empresarial).
UPDATE "Plan"
SET "features" = "features" || '{
  "ordenes-compra": true,
  "recepciones": true,
  "reabastecimiento": true,
  "unidades-conversion": true,
  "lotes-series": true,
  "variantes": true,
  "ubicaciones-avanzadas": true
}'::jsonb
WHERE jsonb_typeof("features") = 'object'
  AND "nombre" IN ('Profesional', 'Empresarial');

-- 3. MRP solo en Empresarial.
UPDATE "Plan"
SET "features" = "features" || '{ "mrp-avanzado": true }'::jsonb
WHERE jsonb_typeof("features") = 'object'
  AND "nombre" = 'Empresarial';

-- 4. Licencias por tenant: núcleo para todas (auditoría no es opcional).
UPDATE "tenant_licenses"
SET "features" = "features" || '{
  "kardex": true,
  "ajustes-inventario": true,
  "conteo-fisico": true
}'::jsonb
WHERE jsonb_typeof("features") = 'object';

-- 5. Licencias con plan Profesional o Empresarial: heredan P1.
UPDATE "tenant_licenses" AS license
SET "features" = license."features" || '{
  "ordenes-compra": true,
  "recepciones": true,
  "reabastecimiento": true,
  "unidades-conversion": true,
  "lotes-series": true,
  "variantes": true,
  "ubicaciones-avanzadas": true
}'::jsonb
FROM "Plan" AS plan
WHERE license."planId" = plan."planId"
  AND plan."nombre" IN ('Profesional', 'Empresarial')
  AND jsonb_typeof(license."features") = 'object';

-- 6. Licencias Empresarial: heredan MRP.
UPDATE "tenant_licenses" AS license
SET "features" = license."features" || '{ "mrp-avanzado": true }'::jsonb
FROM "Plan" AS plan
WHERE license."planId" = plan."planId"
  AND plan."nombre" = 'Empresarial'
  AND jsonb_typeof(license."features") = 'object';
