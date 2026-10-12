-- Reconciliación R6 del historial: solo catálogos, sin datos de negocio.
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
WITH relations AS (
  SELECT c.oid, c.relname
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
), objects AS (
  SELECT r.relname AS relation,
    (SELECT jsonb_agg(jsonb_build_object('name', a.attname,
      'type', format_type(a.atttypid, a.atttypmod), 'notNull', a.attnotnull,
      'default', pg_get_expr(d.adbin, d.adrelid)) ORDER BY a.attnum)
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid
        AND d.adnum = a.attnum
      WHERE a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped) AS columns,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('name', c.conname,
      'validated', c.convalidated, 'definition', pg_get_constraintdef(c.oid))
      ORDER BY c.conname), '[]'::jsonb) FROM pg_constraint c
      WHERE c.conrelid = r.oid) AS constraints,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('name', ic.relname,
      'valid', i.indisvalid, 'ready', i.indisready, 'unique', i.indisunique,
      'definition', pg_get_indexdef(i.indexrelid)) ORDER BY ic.relname), '[]'::jsonb)
      FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid
      WHERE i.indrelid = r.oid) AS indexes
  FROM relations r
)
SELECT jsonb_build_object(
  'capturedAt', clock_timestamp(), 'database', current_database(),
  'transactionReadOnly', current_setting('transaction_read_only'),
  'transactionIsolation', current_setting('transaction_isolation'),
  'relations', (SELECT jsonb_agg(to_jsonb(o) ORDER BY relation) FROM objects o),
  'enums', (SELECT jsonb_agg(jsonb_build_object('type', t.typname,
    'label', e.enumlabel) ORDER BY t.typname, e.enumsortorder)
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid WHERE n.nspname = 'public'
    ),
  'triggers', (SELECT jsonb_agg(jsonb_build_object('name', t.tgname,
    'relation', c.relname, 'enabled', t.tgenabled,
    'definition', pg_get_triggerdef(t.oid)) ORDER BY c.relname, t.tgname)
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal),
  'functions', (SELECT jsonb_agg(jsonb_build_object('name', p.proname,
    'identityArguments', pg_get_function_identity_arguments(p.oid),
    'definition', pg_get_functiondef(p.oid)) ORDER BY p.proname, p.oid)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f')
);
COMMIT;
