-- Agregados focales previos a R5/formal: nunca emite identificadores de negocio.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
SELECT set_config('tcp.audit_expected_database', :'expected_database', true) AS configured \gset
DO $$
BEGIN
  IF current_setting('tcp.audit_expected_database') = '' OR
     current_database() <> current_setting('tcp.audit_expected_database') THEN
    RAISE EXCEPTION 'BASELINE_DATABASE_IDENTITY_MISMATCH';
  END IF;
END $$;
WITH payroll AS (
  SELECT count(*) AS total,
    count(*) FILTER (WHERE e."empleadoId" IS NULL) AS employee_missing,
    count(*) FILTER (WHERE e."empleadoId" IS NOT NULL AND e."tenantId" IS NULL)
      AS employee_tenant_missing,
    count(*) FILTER (WHERE p."tenantId" IS NOT NULL AND e."tenantId" IS NOT NULL
      AND p."tenantId" <> e."tenantId") AS tenant_mismatch,
    count(*) FILTER (WHERE p."tenantId" IS NULL) AS tenant_null
  FROM "Pagosalario" p LEFT JOIN "Empleado" e ON e."empleadoId" = p."empleadoId"
), purchases AS (
  SELECT count(*) AS total,
    count(*) FILTER (WHERE p."gastoCompraId" IS NOT NULL AND g."gastoCompraId" IS NULL)
      AS source_missing,
    count(*) FILTER (WHERE p."gastoCompraId" IS NULL OR g."gastoCompraId" IS NULL
      OR g."tenantId" IS NULL) AS tenant_unverifiable_by_r5_source,
    count(*) FILTER (WHERE p."tenantId" IS NOT NULL AND g."tenantId" IS NOT NULL
      AND p."tenantId" <> g."tenantId") AS tenant_mismatch,
    count(*) FILTER (WHERE p."tenantId" IS NULL) AS tenant_null,
    count(*) FILTER (WHERE product."tenantId" IS DISTINCT FROM p."tenantId")
      AS product_tenant_mismatch,
    count(*) FILTER (WHERE vendor."tenantId" IS DISTINCT FROM p."tenantId")
      AS vendor_tenant_mismatch
  FROM "CompraProducto" p LEFT JOIN "GastoCompra" g
    ON g."gastoCompraId" = p."gastoCompraId"
  LEFT JOIN "Producto" product ON product."id" = p."productoId"
  LEFT JOIN "Vendor" vendor ON vendor."vendorId" = p."proveedorId"
), source_tenants AS (
  SELECT c."cuentaPorPagarId", g."tenantId" FROM "CuentaPorPagar" c
  JOIN "GastoCompra" g ON g."gastoCompraId" = c."gastoCompraId"
  UNION ALL
  SELECT c."cuentaPorPagarId", g."tenantId" FROM "CuentaPorPagar" c
  JOIN "GastosDE" g ON g."gastosDEId" = c."gastosDEId"
  UNION ALL
  SELECT c."cuentaPorPagarId", g."tenantId" FROM "CuentaPorPagar" c
  JOIN "CompraProducto" g ON g."cuentaPorPagarId" = c."cuentaPorPagarId"
  UNION ALL
  SELECT c."cuentaPorPagarId", g."tenantId" FROM "CuentaPorPagar" c
  JOIN "CompraDocumento" g ON g."cuentaPorPagarId" = c."cuentaPorPagarId"
), resolved AS (
  SELECT "cuentaPorPagarId", min("tenantId") AS tenant,
    count(DISTINCT "tenantId") AS tenant_count FROM source_tenants
  GROUP BY "cuentaPorPagarId"
), payables AS (
  SELECT count(*) AS total,
    count(*) FILTER (WHERE r."cuentaPorPagarId" IS NULL) AS unmapped_by_r5_sources,
    count(*) FILTER (WHERE r.tenant_count > 1) AS ambiguous,
    count(*) FILTER (WHERE c."tenantId" IS NOT NULL AND r.tenant IS NOT NULL
      AND c."tenantId" <> r.tenant) AS tenant_mismatch,
    count(*) FILTER (WHERE c."tenantId" IS NULL) AS tenant_null,
    count(*) FILTER (WHERE (c."gastoCompraId" IS NOT NULL AND gc."gastoCompraId" IS NULL)
      OR (c."gastosDEId" IS NOT NULL AND ge."gastosDEId" IS NULL)) AS direct_source_missing
  FROM "CuentaPorPagar" c LEFT JOIN resolved r USING ("cuentaPorPagarId")
  LEFT JOIN "GastoCompra" gc ON gc."gastoCompraId" = c."gastoCompraId"
  LEFT JOIN "GastosDE" ge ON ge."gastosDEId" = c."gastosDEId"
), reconciliations AS (
  SELECT 'venta' AS source, r."tenantId", a."tenantId" AS account_tenant,
    t."tenantId" AS payment_tenant, a."cuentaId", t."tipoId", t."nombre" AS payment_name
  FROM "ReconciliacionVenta" r LEFT JOIN "CuentaBancaria" a USING ("cuentaId")
  LEFT JOIN "TipoPago" t ON t."tipoId" = r."tipoPagoId"
  UNION ALL
  SELECT 'servicio', r."tenantId", a."tenantId", t."tenantId", a."cuentaId", t."tipoId",
    t."nombre"
  FROM "ReconciliacionServicio" r LEFT JOIN "CuentaBancaria" a USING ("cuentaId")
  LEFT JOIN "TipoPago" t ON t."tipoId" = r."tipoPagoId"
  UNION ALL
  SELECT 'gasto', r."tenantId", a."tenantId", t."tenantId", a."cuentaId", t."tipoId",
    t."nombre"
  FROM "ReconciliacionGasto" r LEFT JOIN "CuentaBancaria" a USING ("cuentaId")
  LEFT JOIN "TipoPago" t ON t."tipoId" = r."tipoPagoId"
), reconciliation_results AS (
  SELECT source, count(*) AS total,
    count(*) FILTER (WHERE "cuentaId" IS NULL OR "tipoId" IS NULL) AS orphan,
    count(*) FILTER (WHERE "tenantId" IS NULL) AS tenant_null,
    count(*) FILTER (WHERE "tenantId" IS DISTINCT FROM account_tenant)
      AS account_tenant_mismatch,
    count(*) FILTER (WHERE "tenantId" IS DISTINCT FROM payment_tenant)
      AS payment_tenant_mismatch,
    count(*) FILTER (WHERE "tenantId" IS DISTINCT FROM account_tenant
      OR "tenantId" IS DISTINCT FROM payment_tenant) AS tenant_mismatch
  FROM reconciliations GROUP BY source
), payment_candidates AS (
  SELECT r.source, (
    SELECT count(*) FROM "TipoPago" t
    WHERE t."tenantId" = r."tenantId" AND t."nombre" = r.payment_name
  ) AS candidates
  FROM reconciliations r
  WHERE r."tenantId" IS DISTINCT FROM r.payment_tenant
), candidate_results AS (
  SELECT source,
    count(*) FILTER (WHERE candidates = 0) AS no_same_name_candidate,
    count(*) FILTER (WHERE candidates = 1) AS one_same_name_candidate,
    count(*) FILTER (WHERE candidates > 1) AS ambiguous_same_name_candidates
  FROM payment_candidates GROUP BY source
), restock_duplicates AS (
  SELECT count(*) AS duplicate_groups FROM (
    SELECT "tenantId", "numeroFactura" FROM "GastoCompra"
    WHERE "numeroFactura" IS NOT NULL
    GROUP BY "tenantId", "numeroFactura" HAVING count(*) > 1
  ) duplicates
)
SELECT jsonb_build_object(
  'capturedAt', clock_timestamp(), 'database', current_database(),
  'transactionReadOnly', current_setting('transaction_read_only'),
  'transactionIsolation', current_setting('transaction_isolation'),
  'payroll', (SELECT to_jsonb(p) FROM payroll p),
  'purchases', (SELECT to_jsonb(p) FROM purchases p),
  'payables', (SELECT to_jsonb(p) FROM payables p),
  'sourceTenantsNull', (SELECT count(*) FROM source_tenants WHERE "tenantId" IS NULL),
  'reversePayableSourceMissing', (
    SELECT count(*) FROM (
      SELECT p."cuentaPorPagarId" FROM "CompraProducto" p
      LEFT JOIN "CuentaPorPagar" c USING ("cuentaPorPagarId")
      WHERE p."cuentaPorPagarId" IS NOT NULL AND c."cuentaPorPagarId" IS NULL
      UNION ALL
      SELECT d."cuentaPorPagarId" FROM "CompraDocumento" d
      LEFT JOIN "CuentaPorPagar" c USING ("cuentaPorPagarId")
      WHERE d."cuentaPorPagarId" IS NOT NULL AND c."cuentaPorPagarId" IS NULL
    ) missing),
  'reconciliations', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY source), '[]'::jsonb)
    FROM reconciliation_results r),
  'paymentTypeCandidates', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY source),
    '[]'::jsonb) FROM candidate_results r),
  'restock', (SELECT to_jsonb(d) FROM restock_duplicates d)
);
COMMIT;
