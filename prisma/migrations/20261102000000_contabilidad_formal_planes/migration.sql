-- Habilita la capa formal contable en los tres planes existentes
-- (Básico, Profesional y Empresarial).
--
-- El flag `contabilidad-formal` gobierna postEvento
-- (src/features/contabilidad-formal/services/posting-engine.ts): con el flag
-- inactivo todo emisor devuelve `OMITIDO / FLAG_INACTIVO` y la capa no escribe
-- asientos. Con la activación global, los eventos con emisor implementado
-- (-operaciones Cash contabilizadas: pago de deuda, cobro de préstamo,
-- transferencia/desembolso) quedan registrados con partida doble, hash
-- encadenado y auditoría en el período abierto del tenant.
--
-- La capa falla cerrado: exige plan de cuentas sembrado (35 cuentas + 7
-- diarios + 25 roles), 96 plantillas globales activas, política contable con
-- moneda funcional y un período ABIERTO. Los tenants sin plan contable quedan
-- bloqueados por el guard de períodos ANTES de llegar al emisor formal, por lo
-- que el flag no introduce fallos nuevos en ese caso (se siembran plan y
-- política de todos los tenants con licencia activa antes del deploy).
--
-- Idempotente (patrón 20260905130001): `||` conserva las claves existentes y
-- el UPDATE vuelve a correr sin daño.
UPDATE "Plan"
SET "features" = "features" || '{"contabilidad-formal": true}'::jsonb
WHERE jsonb_typeof("features") = 'object';

-- Las licencias con overrides explícitos conservan su override (precedencia:
-- overrides > plan); ninguna licencia productiva tiene override false para
-- esta clave tras la auditoría de 2026-11-01.
