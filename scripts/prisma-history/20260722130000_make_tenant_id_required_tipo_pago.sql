-- Make tenantId NOT NULL after backfill
-- IMPORTANTE: Ejecutar prisma/seed/backfill-tipos-pago-tenant.ts ANTES de esta migración
ALTER TABLE "TipoPago" ALTER COLUMN "tenantId" SET NOT NULL;
