-- R5.3 formal accounting runtime dependencies omitted from the deployed history.
-- The CxP tenant is resolved only from an authoritative linked source; ambiguous
-- or missing provenance aborts the migration transaction rather than fabricating scope.
-- CompraProducto is also a tenant-owned parent in the current Prisma contract;
-- older deployed versions lack this field, so recover it only through its linked GastoCompra.
-- Payroll ownership is inherited only from the canonical employee. Never infer it
-- from a caller, period, or unrelated payroll reconciliation.
ALTER TABLE "Pagosalario" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
DO $$
DECLARE
  payroll_employee_missing_count BIGINT;
  payroll_employee_tenant_missing_count BIGINT;
  payroll_tenant_mismatch_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO payroll_employee_missing_count
  FROM "Pagosalario" p
  LEFT JOIN "Empleado" e ON e."empleadoId" = p."empleadoId"
  WHERE e."empleadoId" IS NULL;

  SELECT COUNT(*) INTO payroll_employee_tenant_missing_count
  FROM "Pagosalario" p
  JOIN "Empleado" e ON e."empleadoId" = p."empleadoId"
  WHERE e."tenantId" IS NULL;

  SELECT COUNT(*) INTO payroll_tenant_mismatch_count
  FROM "Pagosalario" p
  JOIN "Empleado" e ON e."empleadoId" = p."empleadoId"
  WHERE p."tenantId" IS NOT NULL AND e."tenantId" IS NOT NULL
    AND p."tenantId" <> e."tenantId";

  IF payroll_employee_missing_count > 0 OR payroll_employee_tenant_missing_count > 0
      OR payroll_tenant_mismatch_count > 0 THEN
    RAISE EXCEPTION
      'Cannot safely backfill Pagosalario. payroll_employee_missing=%, payroll_employee_tenant_missing=%, payroll_tenant_mismatch=%',
      payroll_employee_missing_count, payroll_employee_tenant_missing_count,
      payroll_tenant_mismatch_count;
  END IF;
END $$;
UPDATE "Pagosalario" p
SET "tenantId" = e."tenantId"
FROM "Empleado" e
WHERE p."tenantId" IS NULL AND e."empleadoId" = p."empleadoId";
ALTER TABLE "Pagosalario" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "Pagosalario_tenantId_idx" ON "Pagosalario"("tenantId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Pagosalario_tenantId_fkey'
      AND conrelid = '"Pagosalario"'::regclass
  ) THEN
    ALTER TABLE "Pagosalario"
      ADD CONSTRAINT "Pagosalario_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "CompraProducto" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
DO $$
DECLARE
  missing_purchase_source_count BIGINT;
  unverifiable_purchase_count BIGINT;
  purchase_tenant_mismatch_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO missing_purchase_source_count
  FROM "CompraProducto" p
  LEFT JOIN "GastoCompra" g ON g."gastoCompraId" = p."gastoCompraId"
  WHERE p."gastoCompraId" IS NOT NULL AND g."gastoCompraId" IS NULL;

  SELECT COUNT(*) INTO unverifiable_purchase_count
  FROM "CompraProducto" p
  LEFT JOIN "GastoCompra" g ON g."gastoCompraId" = p."gastoCompraId"
  WHERE p."gastoCompraId" IS NULL OR g."gastoCompraId" IS NULL OR g."tenantId" IS NULL;

  SELECT COUNT(*) INTO purchase_tenant_mismatch_count
  FROM "CompraProducto" p
  JOIN "GastoCompra" g ON g."gastoCompraId" = p."gastoCompraId"
  WHERE p."tenantId" IS NOT NULL AND g."tenantId" IS NOT NULL
    AND p."tenantId" <> g."tenantId";

  IF missing_purchase_source_count > 0 OR unverifiable_purchase_count > 0
      OR purchase_tenant_mismatch_count > 0 THEN
    RAISE EXCEPTION
      'Cannot safely backfill CompraProducto. source_missing=%, tenant_unverifiable=%, tenant_mismatch=%',
      missing_purchase_source_count, unverifiable_purchase_count,
      purchase_tenant_mismatch_count;
  END IF;
END $$;
UPDATE "CompraProducto" p
SET "tenantId" = g."tenantId"
FROM "GastoCompra" g
WHERE p."tenantId" IS NULL AND g."gastoCompraId" = p."gastoCompraId";
ALTER TABLE "CompraProducto" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "CompraProducto_tenantId_idx" ON "CompraProducto"("tenantId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CompraProducto_tenantId_fkey'
      AND conrelid = '"CompraProducto"'::regclass
  ) THEN
    ALTER TABLE "CompraProducto"
      ADD CONSTRAINT "CompraProducto_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "CuentaPorPagar"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "tipoDeuda" TEXT;

DO $$
DECLARE
  missing_direct_source_count BIGINT;
  missing_reverse_source_count BIGINT;
  missing_tenant_source_count BIGINT;
  unmapped_count BIGINT;
  ambiguous_count BIGINT;
  mismatched_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO missing_direct_source_count
  FROM "CuentaPorPagar" c
  LEFT JOIN "GastoCompra" gc ON gc."gastoCompraId" = c."gastoCompraId"
  LEFT JOIN "GastosDE" ge ON ge."gastosDEId" = c."gastosDEId"
  WHERE (c."gastoCompraId" IS NOT NULL AND gc."gastoCompraId" IS NULL)
     OR (c."gastosDEId" IS NOT NULL AND ge."gastosDEId" IS NULL);

  SELECT
    (SELECT COUNT(*) FROM "CompraProducto" p
      LEFT JOIN "CuentaPorPagar" c ON c."cuentaPorPagarId" = p."cuentaPorPagarId"
      WHERE p."cuentaPorPagarId" IS NOT NULL AND c."cuentaPorPagarId" IS NULL)
    +
    (SELECT COUNT(*) FROM "CompraDocumento" d
      LEFT JOIN "CuentaPorPagar" c ON c."cuentaPorPagarId" = d."cuentaPorPagarId"
      WHERE d."cuentaPorPagarId" IS NOT NULL AND c."cuentaPorPagarId" IS NULL)
  INTO missing_reverse_source_count;

  SELECT COUNT(*) INTO missing_tenant_source_count
  FROM (
    SELECT gc."tenantId"
    FROM "CuentaPorPagar" c
    JOIN "GastoCompra" gc ON gc."gastoCompraId" = c."gastoCompraId"
    WHERE c."gastoCompraId" IS NOT NULL
    UNION ALL
    SELECT ge."tenantId"
    FROM "CuentaPorPagar" c
    JOIN "GastosDE" ge ON ge."gastosDEId" = c."gastosDEId"
    WHERE c."gastosDEId" IS NOT NULL
    UNION ALL
    SELECT d."tenantId"
    FROM "CuentaPorPagar" c
    JOIN "CompraDocumento" d ON d."cuentaPorPagarId" = c."cuentaPorPagarId"
  ) sources
  WHERE sources."tenantId" IS NULL;

  WITH source_tenants AS (
    SELECT c."cuentaPorPagarId", g."tenantId"
    FROM "CuentaPorPagar" c
    JOIN "GastoCompra" g ON g."gastoCompraId" = c."gastoCompraId"
    WHERE c."gastoCompraId" IS NOT NULL
    UNION ALL
    SELECT c."cuentaPorPagarId", g."tenantId"
    FROM "CuentaPorPagar" c
    JOIN "GastosDE" g ON g."gastosDEId" = c."gastosDEId"
    WHERE c."gastosDEId" IS NOT NULL
    UNION ALL
    SELECT c."cuentaPorPagarId", g."tenantId"
    FROM "CuentaPorPagar" c
    JOIN "CompraProducto" g ON g."cuentaPorPagarId" = c."cuentaPorPagarId"
    UNION ALL
    SELECT c."cuentaPorPagarId", g."tenantId"
    FROM "CuentaPorPagar" c
    JOIN "CompraDocumento" g ON g."cuentaPorPagarId" = c."cuentaPorPagarId"
  ), resolved AS (
    SELECT "cuentaPorPagarId", MIN("tenantId") AS "tenantId",
      COUNT(DISTINCT "tenantId") AS tenant_count
    FROM source_tenants
    GROUP BY "cuentaPorPagarId"
  )
  SELECT
    COUNT(*) FILTER (WHERE r."cuentaPorPagarId" IS NULL),
    COUNT(*) FILTER (WHERE r.tenant_count > 1),
    COUNT(*) FILTER (
      WHERE c."tenantId" IS NOT NULL AND r."tenantId" IS NOT NULL
        AND c."tenantId" <> r."tenantId"
    )
  INTO unmapped_count, ambiguous_count, mismatched_count
  FROM "CuentaPorPagar" c
  LEFT JOIN resolved r ON r."cuentaPorPagarId" = c."cuentaPorPagarId";

  IF missing_direct_source_count > 0 OR missing_reverse_source_count > 0
      OR missing_tenant_source_count > 0 OR unmapped_count > 0
      OR ambiguous_count > 0 OR mismatched_count > 0 THEN
    RAISE EXCEPTION
      'Cannot safely backfill CuentaPorPagar. direct_source_missing=%, reverse_source_missing=%, source_tenant_missing=%, unmapped=%, ambiguous=%, existing_tenant_mismatch=%',
      missing_direct_source_count, missing_reverse_source_count,
      missing_tenant_source_count, unmapped_count, ambiguous_count, mismatched_count;
  END IF;
END $$;

WITH source_tenants AS (
  SELECT c."cuentaPorPagarId", g."tenantId"
  FROM "CuentaPorPagar" c
  JOIN "GastoCompra" g ON g."gastoCompraId" = c."gastoCompraId"
  WHERE c."gastoCompraId" IS NOT NULL
  UNION ALL
  SELECT c."cuentaPorPagarId", g."tenantId"
  FROM "CuentaPorPagar" c
  JOIN "GastosDE" g ON g."gastosDEId" = c."gastosDEId"
  WHERE c."gastosDEId" IS NOT NULL
  UNION ALL
  SELECT c."cuentaPorPagarId", g."tenantId"
  FROM "CuentaPorPagar" c
  JOIN "CompraProducto" g ON g."cuentaPorPagarId" = c."cuentaPorPagarId"
  UNION ALL
  SELECT c."cuentaPorPagarId", g."tenantId"
  FROM "CuentaPorPagar" c
  JOIN "CompraDocumento" g ON g."cuentaPorPagarId" = c."cuentaPorPagarId"
), resolved AS (
  SELECT "cuentaPorPagarId", MIN("tenantId") AS "tenantId"
  FROM source_tenants
  GROUP BY "cuentaPorPagarId"
)
UPDATE "CuentaPorPagar" c
SET "tenantId" = r."tenantId"
FROM resolved r
WHERE r."cuentaPorPagarId" = c."cuentaPorPagarId"
  AND c."tenantId" IS NULL;

ALTER TABLE "CuentaPorPagar" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "CuentaPorPagar_tenantId_idx" ON "CuentaPorPagar"("tenantId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CuentaPorPagar_tenantId_fkey'
      AND conrelid = '"CuentaPorPagar"'::regclass
  ) THEN
    ALTER TABLE "CuentaPorPagar"
      ADD CONSTRAINT "CuentaPorPagar_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "ReconciliacionVenta"
  ADD COLUMN IF NOT EXISTS "deudaCashId" TEXT,
  ADD COLUMN IF NOT EXISTS "prestamoCashId" TEXT,
  ADD COLUMN IF NOT EXISTS "tipoReconciliacion" TEXT,
  ALTER COLUMN "ventaId" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "DeudaCash" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "idNumerico" SERIAL NOT NULL,
  "proveedorId" TEXT NOT NULL,
  "cuentaPorPagarId" TEXT NOT NULL,
  "montoCapital" DECIMAL(65,30) NOT NULL,
  "moneda" TEXT NOT NULL DEFAULT 'CUP',
  "tasaInteres" DECIMAL(65,30),
  "fechaVencimiento" TIMESTAMP(3),
  "observaciones" TEXT,
  "createdById" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "comprobanteUrl" TEXT,
  "cuentaBancariaId" TEXT,
  "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
  CONSTRAINT "DeudaCash_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PrestamoCash" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "idNumerico" SERIAL NOT NULL,
  "clienteId" TEXT NOT NULL,
  "cuentaPorCobrarId" TEXT NOT NULL,
  "montoCapital" DECIMAL(65,30) NOT NULL,
  "moneda" TEXT NOT NULL DEFAULT 'CUP',
  "tasaInteres" DECIMAL(65,30),
  "fechaOtorgamiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaVencimiento" TIMESTAMP(3),
  "observaciones" TEXT,
  "createdById" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tasaCambioAlCrear" DECIMAL(65,30),
  "cuentaBancariaId" TEXT,
  "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
  CONSTRAINT "PrestamoCash_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "periodo_cache" (
  "cacheKey" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL,
  "resultadoJson" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "periodo_cache_pkey" PRIMARY KEY ("cacheKey")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeudaCash_cuentaPorPagarId_key" ON "DeudaCash"("cuentaPorPagarId");
CREATE INDEX IF NOT EXISTS "DeudaCash_tenantId_idx" ON "DeudaCash"("tenantId");
CREATE INDEX IF NOT EXISTS "DeudaCash_proveedorId_idx" ON "DeudaCash"("proveedorId");
CREATE INDEX IF NOT EXISTS "DeudaCash_estado_idx" ON "DeudaCash"("estado");
CREATE UNIQUE INDEX IF NOT EXISTS "PrestamoCash_cuentaPorCobrarId_key" ON "PrestamoCash"("cuentaPorCobrarId");
CREATE INDEX IF NOT EXISTS "PrestamoCash_tenantId_idx" ON "PrestamoCash"("tenantId");
CREATE INDEX IF NOT EXISTS "PrestamoCash_clienteId_idx" ON "PrestamoCash"("clienteId");
CREATE INDEX IF NOT EXISTS "PrestamoCash_estado_idx" ON "PrestamoCash"("estado");
CREATE INDEX IF NOT EXISTS "periodo_cache_tenantId_expiresAt_idx" ON "periodo_cache"("tenantId", "expiresAt");
CREATE INDEX IF NOT EXISTS "periodo_cache_expiresAt_idx" ON "periodo_cache"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReconciliacionVenta_deudaCashId_fkey'
    AND conrelid = '"ReconciliacionVenta"'::regclass) THEN
    ALTER TABLE "ReconciliacionVenta" ADD CONSTRAINT "ReconciliacionVenta_deudaCashId_fkey"
      FOREIGN KEY ("deudaCashId") REFERENCES "DeudaCash"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReconciliacionVenta_prestamoCashId_fkey'
    AND conrelid = '"ReconciliacionVenta"'::regclass) THEN
    ALTER TABLE "ReconciliacionVenta" ADD CONSTRAINT "ReconciliacionVenta_prestamoCashId_fkey"
      FOREIGN KEY ("prestamoCashId") REFERENCES "PrestamoCash"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeudaCash_tenantId_fkey'
    AND conrelid = '"DeudaCash"'::regclass) THEN
    ALTER TABLE "DeudaCash" ADD CONSTRAINT "DeudaCash_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeudaCash_proveedorId_fkey'
    AND conrelid = '"DeudaCash"'::regclass) THEN
    ALTER TABLE "DeudaCash" ADD CONSTRAINT "DeudaCash_proveedorId_fkey"
      FOREIGN KEY ("proveedorId") REFERENCES "Vendor"("vendorId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeudaCash_cuentaPorPagarId_fkey'
    AND conrelid = '"DeudaCash"'::regclass) THEN
    ALTER TABLE "DeudaCash" ADD CONSTRAINT "DeudaCash_cuentaPorPagarId_fkey"
      FOREIGN KEY ("cuentaPorPagarId") REFERENCES "CuentaPorPagar"("cuentaPorPagarId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrestamoCash_tenantId_fkey'
    AND conrelid = '"PrestamoCash"'::regclass) THEN
    ALTER TABLE "PrestamoCash" ADD CONSTRAINT "PrestamoCash_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrestamoCash_clienteId_fkey'
    AND conrelid = '"PrestamoCash"'::regclass) THEN
    ALTER TABLE "PrestamoCash" ADD CONSTRAINT "PrestamoCash_clienteId_fkey"
      FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrestamoCash_cuentaPorCobrarId_fkey'
    AND conrelid = '"PrestamoCash"'::regclass) THEN
    ALTER TABLE "PrestamoCash" ADD CONSTRAINT "PrestamoCash_cuentaPorCobrarId_fkey"
      FOREIGN KEY ("cuentaPorCobrarId") REFERENCES "CuentaPorCobrar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
