-- Ensayo exclusivamente local. No es una migración autorizada de producción.
-- psql -X -w -qAt -v ON_ERROR_STOP=1 -v expected_database=... -f este_archivo
BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
SELECT set_config('tcp.audit_expected_database', :'expected_database', true) AS configured \gset
DO $$
BEGIN
  IF current_database() <> current_setting('tcp.audit_expected_database')
    OR current_database() !~ '^tcp_r6_prod_clone_[a-f0-9]{12}_trial[0-9]+$'
    OR NOT coalesce(inet_server_addr() IN ('127.0.0.1'::inet, '::1'::inet), false)
    OR inet_server_port() IS DISTINCT FROM 5433 THEN
    RAISE EXCEPTION 'R6_REPAIR_REQUIRES_ISOLATED_LOCAL_TRIAL';
  END IF;
END $$;

LOCK TABLE "TipoPago", "CuentaBancaria", "ReconciliacionVenta",
  "ReconciliacionServicio", "ReconciliacionGasto" IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE _r6_payment_refs ON COMMIT DROP AS
SELECT 'ReconciliacionVenta' AS entity, "reconciliacionId" AS id,
  "tenantId", "tipoPagoId", "cuentaId" FROM "ReconciliacionVenta"
UNION ALL
SELECT 'ReconciliacionServicio', "reconciliacionId", "tenantId", "tipoPagoId", "cuentaId"
  FROM "ReconciliacionServicio"
UNION ALL
SELECT 'ReconciliacionGasto', "reconciliacionId", "tenantId", "tipoPagoId", "cuentaId"
  FROM "ReconciliacionGasto";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM _r6_payment_refs r
    LEFT JOIN "TipoPago" t ON t."tipoId" = r."tipoPagoId"
    LEFT JOIN "CuentaBancaria" a ON a."cuentaId" = r."cuentaId"
    WHERE r."tenantId" IS NULL OR t."tipoId" IS NULL OR a."cuentaId" IS NULL
      OR a."tenantId" IS DISTINCT FROM r."tenantId"
  ) THEN
    RAISE EXCEPTION 'R6_REPAIR_INVALID_REFERENCE_OR_ACCOUNT_TENANT';
  END IF;
END $$;

CREATE TEMP TABLE _r6_payment_map ON COMMIT DROP AS
SELECT DISTINCT r."tenantId", t."tipoId" AS source_id,
  'r6_tipo_pago_' || md5(jsonb_build_array(r."tenantId", t."tipoId")::text) AS target_id,
  t."nombre", t."descripcion", t."requiereCuenta", t."isActive",
  t."cuentaDefecto" AS source_default
FROM _r6_payment_refs r JOIN "TipoPago" t ON t."tipoId" = r."tipoPagoId"
WHERE t."tenantId" IS DISTINCT FROM r."tenantId";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _r6_payment_map WHERE "requiereCuenta" IS DISTINCT FROM false) THEN
    RAISE EXCEPTION 'R6_REPAIR_REQUIRED_ACCOUNT_TYPE_NEEDS_REVIEW';
  END IF;
  IF EXISTS (
    SELECT 1 FROM _r6_payment_map GROUP BY "tenantId", "nombre" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'R6_REPAIR_MULTIPLE_SOURCE_TYPES_NEED_REVIEW';
  END IF;
  IF EXISTS (
    SELECT 1 FROM _r6_payment_map m JOIN "TipoPago" t ON t."tipoId" = m.target_id
    WHERE t."tenantId" IS DISTINCT FROM m."tenantId"
      OR t."nombre" IS DISTINCT FROM m."nombre"
      OR t."descripcion" IS DISTINCT FROM m."descripcion"
      OR t."requiereCuenta" IS DISTINCT FROM m."requiereCuenta"
      OR t."isActive" IS DISTINCT FROM m."isActive"
      OR t."cuentaDefecto" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'R6_REPAIR_TARGET_ID_CONFLICT';
  END IF;
  IF EXISTS (
    SELECT 1 FROM _r6_payment_map m JOIN "TipoPago" t
      ON t."tenantId" = m."tenantId" AND t."nombre" = m."nombre"
    WHERE t."tipoId" <> m.target_id
  ) THEN
    RAISE EXCEPTION 'R6_REPAIR_EXISTING_NAMED_TYPE_NEEDS_REVIEW';
  END IF;
END $$;

CREATE TEMP TABLE _r6_repair_changes (
  entity TEXT, id TEXT, tenant_id TEXT, source_id TEXT, target_id TEXT
) ON COMMIT DROP;

WITH inserted AS (
  INSERT INTO "TipoPago" (
    "tipoId", "tenantId", "nombre", "descripcion", "requiereCuenta", "cuentaDefecto",
    "isActive", "createdAt", "updatedAt"
  ) SELECT target_id, "tenantId", "nombre", "descripcion", "requiereCuenta", NULL,
    "isActive", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM _r6_payment_map
  ON CONFLICT ("tipoId") DO NOTHING RETURNING "tipoId", "tenantId"
)
INSERT INTO _r6_repair_changes
SELECT 'TipoPago', i."tipoId", i."tenantId", m.source_id, m.target_id
FROM inserted i JOIN _r6_payment_map m ON m.target_id = i."tipoId";

WITH repaired AS (
  UPDATE "ReconciliacionVenta" r SET "tipoPagoId" = m.target_id
  FROM _r6_payment_map m WHERE r."tenantId" = m."tenantId" AND r."tipoPagoId" = m.source_id
  RETURNING r."reconciliacionId", r."tenantId", m.source_id, m.target_id
) INSERT INTO _r6_repair_changes SELECT 'ReconciliacionVenta', * FROM repaired;
WITH repaired AS (
  UPDATE "ReconciliacionServicio" r SET "tipoPagoId" = m.target_id
  FROM _r6_payment_map m WHERE r."tenantId" = m."tenantId" AND r."tipoPagoId" = m.source_id
  RETURNING r."reconciliacionId", r."tenantId", m.source_id, m.target_id
) INSERT INTO _r6_repair_changes SELECT 'ReconciliacionServicio', * FROM repaired;
WITH repaired AS (
  UPDATE "ReconciliacionGasto" r SET "tipoPagoId" = m.target_id
  FROM _r6_payment_map m WHERE r."tenantId" = m."tenantId" AND r."tipoPagoId" = m.source_id
  RETURNING r."reconciliacionId", r."tenantId", m.source_id, m.target_id
) INSERT INTO _r6_repair_changes SELECT 'ReconciliacionGasto', * FROM repaired;

-- Actor explícitamente sintético del ensayo, sin atribuirlo a una sesión real.
INSERT INTO "AuditLog" ("id", "entidad", "entidadId", "accion", "usuarioId", "detalles")
SELECT 'r6_tp_repair_' || md5(jsonb_build_array(c.entity, c.id, c.target_id)::text),
  c.entity, c.id, 'REPAIR_TENANT_SCOPE', 'r6-local-rehearsal',
  jsonb_build_object('trialOnly', true, 'tenantId', c.tenant_id,
    'sourcePaymentTypeId', c.source_id, 'targetPaymentTypeId', c.target_id,
    'sourceDefaultAccountId', m.source_default,
    'copiedConfiguration', jsonb_build_object('nombre', m."nombre",
      'descripcion', m."descripcion", 'requiereCuenta', m."requiereCuenta",
      'isActive', m."isActive"),
    'defaultAccountPolicy', 'CLEAR', 'preserveFinancialFields', true)
FROM _r6_repair_changes c JOIN _r6_payment_map m
  ON m."tenantId" = c.tenant_id AND m.source_id = c.source_id;

SELECT jsonb_build_object(
  'database', current_database(), 'trialOnly', true,
  'createdPaymentTypes', (SELECT count(*) FROM _r6_repair_changes WHERE entity = 'TipoPago'),
  'repairedReferences', (SELECT count(*) FROM _r6_repair_changes WHERE entity <> 'TipoPago'),
  'auditRows', (SELECT count(*) FROM _r6_repair_changes)
);
COMMIT;
