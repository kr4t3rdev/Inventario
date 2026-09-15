-- Repair migration for databases that recorded the adjustment date migration
-- before accounting tenant columns were restored in migration history.
ALTER TABLE "AjusteBancario" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "TransferenciaBancaria" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

UPDATE "AjusteBancario" adjustment
SET "tenantId" = account."tenantId"
FROM "CuentaBancaria" account
WHERE adjustment."cuentaId" = account."cuentaId"
  AND adjustment."tenantId" IS NULL;
UPDATE "TransferenciaBancaria" transfer
SET "tenantId" = origin."tenantId"
FROM "CuentaBancaria" origin
WHERE transfer."cuentaOrigenId" = origin."cuentaId"
  AND transfer."tenantId" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "TransferenciaBancaria" transfer
    JOIN "CuentaBancaria" destination ON destination."cuentaId" = transfer."cuentaDestinoId"
    WHERE destination."tenantId" <> transfer."tenantId"
  ) THEN
    RAISE EXCEPTION 'TransferenciaBancaria references accounts from different tenants';
  END IF;
  IF EXISTS (SELECT 1 FROM "AjusteBancario" WHERE "tenantId" IS NULL)
     OR EXISTS (SELECT 1 FROM "TransferenciaBancaria" WHERE "tenantId" IS NULL) THEN
    RAISE EXCEPTION 'Could not assign tenantId to all accounting records';
  END IF;
END $$;

ALTER TABLE "AjusteBancario" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "TransferenciaBancaria" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "AjusteBancario_tenantId_idx" ON "AjusteBancario"("tenantId");
CREATE INDEX IF NOT EXISTS "TransferenciaBancaria_tenantId_idx" ON "TransferenciaBancaria"("tenantId");
DROP INDEX IF EXISTS "TransferenciaBancaria_numeroComprobante_key";
CREATE UNIQUE INDEX IF NOT EXISTS "TransferenciaBancaria_tenantId_numeroComprobante_key"
  ON "TransferenciaBancaria"("tenantId", "numeroComprobante");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AjusteBancario_tenantId_fkey') THEN
    ALTER TABLE "AjusteBancario" ADD CONSTRAINT "AjusteBancario_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TransferenciaBancaria_tenantId_fkey') THEN
    ALTER TABLE "TransferenciaBancaria" ADD CONSTRAINT "TransferenciaBancaria_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
