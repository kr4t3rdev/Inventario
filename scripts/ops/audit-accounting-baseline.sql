-- R6-BASELINE: diagnóstico de catálogos, sin cambios de esquema ni datos de negocio.
-- Uso: psql -X -w -qAt "$PRODUCTION_DATABASE_URL" -v ON_ERROR_STOP=1 \
--   -v expected_database="$PRODUCTION_DATABASE_NAME" -f scripts/ops/audit-accounting-baseline.sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
SELECT set_config('tcp.audit_expected_database', :'expected_database', true) AS config_set \gset

DO $$
BEGIN
  IF current_setting('tcp.audit_expected_database') = '' OR
     current_database() <> current_setting('tcp.audit_expected_database') THEN
    RAISE EXCEPTION 'BASELINE_DATABASE_IDENTITY_MISMATCH';
  END IF;
END $$;

-- El historial puede no existir en un heredado. Consultarlo dinámicamente evita
-- asumir que una base sin _prisma_migrations está migrada o requiere un reset.
DO $$
DECLARE history jsonb := '[]'::jsonb;
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    EXECUTE 'SELECT coalesce(jsonb_agg(jsonb_build_object(
      ''migrationName'', migration_name, ''checksum'', checksum,
      ''finishedAt'', finished_at, ''rolledBackAt'', rolled_back_at,
      ''appliedStepsCount'', applied_steps_count) ORDER BY migration_name, started_at),
      ''[]''::jsonb) FROM public._prisma_migrations' INTO history;
  END IF;
  PERFORM set_config('tcp.audit_migrations', history::text, true);
END $$;

WITH required_triggers(name, relation_name) AS (VALUES
  ('stock_move_line_no_update', 'StockMoveLine'),
  ('stock_move_line_no_delete', 'StockMoveLine'),
  ('apertura_revisiones_protect_lifecycle', 'apertura_revisiones'),
  ('apertura_revisiones_lineas_immutable', 'lineas_apertura_periodo'),
  ('snapshot_periodos_approved_immutable_update', 'snapshot_periodos'),
  ('snapshot_periodos_approved_immutable_delete', 'snapshot_periodos'),
  ('fx_evidence_immutable_update', 'fx_evidence'),
  ('fx_evidence_immutable_delete', 'fx_evidence'),
  ('financial_auxiliary_checkpoints_immutable_update', 'financial_auxiliary_checkpoints'),
  ('financial_auxiliary_checkpoints_immutable_delete', 'financial_auxiliary_checkpoints'),
  ('tenant_accounting_policy_currency_immutable_after_evidence', 'tenant_accounting_policies')
), required_constraints(name, relation_name) AS (VALUES
  ('contab_replay_approval_different_actor_check', 'contabilidad_replay_approvals'),
  ('contab_replay_preflight_24h_expiry_check', 'contabilidad_replay_preflights'),
  ('lineas_apertura_periodo_fx_evidence_complete_check', 'lineas_apertura_periodo'),
  ('lineas_apertura_periodo_evidencia_sha256_check', 'lineas_apertura_periodo'),
  ('lineas_apertura_periodo_lado_check', 'lineas_apertura_periodo'),
  ('ReconciliacionServicio_idempotencyPair_check', 'ReconciliacionServicio'),
  ('ReconciliacionServicio_accountAmountPair_check', 'ReconciliacionServicio'),
  ('ReconciliacionServicio_sourceAccountAmountPair_check', 'ReconciliacionServicio'),
  ('ReconciliacionVenta_accountAmountPair_check', 'ReconciliacionVenta'),
  ('ReconciliacionVenta_sourceAccountAmountPair_check', 'ReconciliacionVenta'),
  ('ReconciliacionGasto_accountAmountPair_check', 'ReconciliacionGasto')
), trigger_results AS (
  SELECT r.name, r.relation_name AS relation,
    coalesce(t.tgenabled IN ('O', 'A') AND NOT t.tgisinternal, false) AS ready,
    t.tgenabled AS enabled,
    CASE WHEN t.oid IS NOT NULL THEN pg_get_triggerdef(t.oid) END AS definition,
    CASE WHEN t.oid IS NOT NULL THEN md5(pg_get_functiondef(t.tgfoid)) END AS function_hash
  FROM required_triggers r
  LEFT JOIN pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = r.relation_name
  LEFT JOIN pg_trigger t ON t.tgrelid = c.oid AND t.tgname = r.name
), constraint_results AS (
  SELECT r.name, r.relation_name AS relation,
    coalesce(con.convalidated AND con.contype = 'c', false) AS ready,
    CASE WHEN con.oid IS NOT NULL THEN pg_get_constraintdef(con.oid) END AS definition
  FROM required_constraints r
  LEFT JOIN pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = r.relation_name
  LEFT JOIN pg_constraint con ON con.conrelid = c.oid AND con.conname = r.name
), index_results AS (
  SELECT 'ReconciliacionServicio_tenantId_idempotencyKey_key' AS name,
    coalesce(i.indisunique AND i.indisvalid AND i.indisready AND i.indpred IS NULL, false)
      AS ready,
    CASE WHEN i.indexrelid IS NOT NULL THEN pg_get_indexdef(i.indexrelid) END AS definition
  FROM (SELECT 1) seed
  LEFT JOIN pg_index i ON i.indexrelid =
    to_regclass('public."ReconciliacionServicio_tenantId_idempotencyKey_key"')
    AND i.indrelid = to_regclass('public."ReconciliacionServicio"')
)
SELECT jsonb_build_object(
  'capturedAt', clock_timestamp(),
  'identity', jsonb_build_object('database', current_database(), 'role', current_user,
    'serverAddress', inet_server_addr(), 'serverPort', inet_server_port(),
    'serverVersion', current_setting('server_version'), 'inRecovery', pg_is_in_recovery(),
    'transactionReadOnly', current_setting('transaction_read_only'),
    'transactionIsolation', current_setting('transaction_isolation')),
  'schema', 'public',
  'guardsReady', (SELECT bool_and(ready) FROM (
    SELECT ready FROM trigger_results UNION ALL SELECT ready FROM constraint_results
    UNION ALL SELECT ready FROM index_results) results),
  'triggers', (SELECT jsonb_agg(to_jsonb(t) ORDER BY name) FROM trigger_results t),
  'constraints', (SELECT jsonb_agg(to_jsonb(c) ORDER BY name) FROM constraint_results c),
  'indexes', (SELECT jsonb_agg(to_jsonb(i) ORDER BY name) FROM index_results i),
  'migrationHistoryPresent', to_regclass('public._prisma_migrations') IS NOT NULL,
  'migrations', current_setting('tcp.audit_migrations')::jsonb
);
COMMIT;
