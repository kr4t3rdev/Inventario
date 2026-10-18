BEGIN;

-- The current Prisma model requires this optional field for cash-debt payables.
-- No default or historical value is inferred; existing rows remain NULL.
ALTER TABLE "CuentaPorPagar" ADD COLUMN "tipoDeuda" TEXT;

COMMIT;
