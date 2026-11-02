ALTER TABLE "OrdenReparacion"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

UPDATE "OrdenReparacion" AS orden
SET "tenantId" = cliente."tenantId"
FROM "Cliente" AS cliente
WHERE orden."clienteId" = cliente."clienteId"
  AND orden."tenantId" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "OrdenReparacion" AS orden
    LEFT JOIN "Cliente" AS cliente
      ON cliente."clienteId" = orden."clienteId"
    WHERE cliente."clienteId" IS NULL
      OR cliente."tenantId" IS NULL
      OR orden."tenantId" IS DISTINCT FROM cliente."tenantId"
  ) THEN
    RAISE EXCEPTION 'OrdenReparacion tenant ownership could not be backfilled consistently';
  END IF;
END $$;

ALTER TABLE "OrdenReparacion"
  ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "OrdenReparacion_tenantId_idx"
  ON "OrdenReparacion"("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OrdenReparacion_tenantId_fkey'
      AND conrelid = '"OrdenReparacion"'::regclass
  ) THEN
    ALTER TABLE "OrdenReparacion"
      ADD CONSTRAINT "OrdenReparacion_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
