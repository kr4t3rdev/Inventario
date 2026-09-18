-- Backfill tenantId for TipoPago records
-- Resuelve el tenant desde reconciliaciones existentes, con fallback al primer tenant
BEGIN;

UPDATE "TipoPago" tp
SET "tenantId" = (
    SELECT COALESCE(
        (SELECT "tenantId" FROM "ReconciliacionVenta" WHERE "tipoPagoId" = tp."tipoId" AND "tenantId" IS NOT NULL LIMIT 1),
        (SELECT "tenantId" FROM "ReconciliacionServicio" WHERE "tipoPagoId" = tp."tipoId" AND "tenantId" IS NOT NULL LIMIT 1),
        (SELECT "tenantId" FROM "ReconciliacionGasto" WHERE "tipoPagoId" = tp."tipoId" AND "tenantId" IS NOT NULL LIMIT 1),
        (SELECT "tenantId" FROM "tenants" ORDER BY "createdAt" LIMIT 1)
    )
)
WHERE tp."tenantId" IS NULL;

DO $$
DECLARE
    total_null integer;
BEGIN
    SELECT COUNT(*) INTO total_null FROM "TipoPago" WHERE "tenantId" IS NULL;
    IF total_null > 0 THEN
        RAISE EXCEPTION 'Quedaron % TipoPago sin tenantId después del backfill', total_null;
    END IF;
END $$;

COMMIT;
