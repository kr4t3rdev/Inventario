BEGIN;

LOCK TABLE "tenants", "CuentaPorPagar", "PagoCuentaPorPagar"
  IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE "PagoCuentaPorPagar"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PagoCuentaPorPagar" payment
    LEFT JOIN "CuentaPorPagar" payable
      ON payable."cuentaPorPagarId" = payment."cuentaPorPagarId"
    LEFT JOIN "tenants" tenant
      ON tenant."tenantId" = payable."tenantId"
    WHERE payable."cuentaPorPagarId" IS NULL
      OR tenant."tenantId" IS NULL
      OR (
        payment."tenantId" IS NOT NULL
        AND payment."tenantId" IS DISTINCT FROM payable."tenantId"
      )
  ) THEN
    RAISE EXCEPTION
      'PagoCuentaPorPagar: missing or conflicting CuentaPorPagar tenant ownership';
  END IF;
END $$;

UPDATE "PagoCuentaPorPagar" payment
SET "tenantId" = payable."tenantId"
FROM "CuentaPorPagar" payable
WHERE payment."cuentaPorPagarId" = payable."cuentaPorPagarId"
  AND payment."tenantId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "PagoCuentaPorPagar" WHERE "tenantId" IS NULL) THEN
    RAISE EXCEPTION 'PagoCuentaPorPagar: tenantId backfill is incomplete';
  END IF;
END $$;

ALTER TABLE "PagoCuentaPorPagar" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "PagoCuentaPorPagar_tenantId_idx"
  ON "PagoCuentaPorPagar"("tenantId");
ALTER TABLE "PagoCuentaPorPagar"
  ADD CONSTRAINT "PagoCuentaPorPagar_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
