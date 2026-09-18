-- Backfill PVE (solo si producción corre con PRISMA_MIGRATION_MODE=db-push, donde
-- las migraciones SQL NO se ejecutan): clasifica las ventas históricas.
-- Ejecutar UNA vez contra la base de producción tras el deploy.
-- Uso: railway connect postgres -f scripts/backfill/pve-backfill-estado-venta.sql
--      (o pegar en el query editor de Railway)
BEGIN;

UPDATE "Venta" SET estado = 'ANULADA' WHERE "deletedAt" IS NOT NULL;
UPDATE "Venta" v SET estado = 'FACTURADA'
FROM "facturas" f
WHERE f."ventaId" = v."ventaId" AND v."deletedAt" IS NULL;

COMMIT;
