-- Habilita el cambio de moneda principal (política contable) SOLO en el plan
-- Empresarial. Requisito: las demás empresas no pueden cambiar la moneda
-- principal; además, el servicio de política bloquea el cambio cuando la
-- empresa ya tiene movimientos contables (FUNCTIONAL_CURRENCY_IMMUTABLE).
--
-- La clave nueva no existe en snapshots legacy de licencias, y la precedencia
-- es overrides > plan > snapshot legacy (src/lib/plan-features.ts), por lo que
-- basta con actualizar la tabla "Plan".
--
-- Idempotente (patrón 20260905130001): `||` conserva las claves existentes y
-- el UPDATE vuelve a correr sin daño.
UPDATE "Plan"
SET "features" = "features" || '{ "moneda-principal-cambio": true }'::jsonb
WHERE jsonb_typeof("features") = 'object'
  AND "nombre" = 'Empresarial';

UPDATE "Plan"
SET "features" = "features" || '{ "moneda-principal-cambio": false }'::jsonb
WHERE jsonb_typeof("features") = 'object'
  AND "nombre" <> 'Empresarial';
