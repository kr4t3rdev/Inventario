#!/usr/bin/env bash
set -euo pipefail

# Exercises the exact migration against isolated schemas in a disposable local DB.
# Never redirect this harness to a shared or non-local PostgreSQL instance.
export PGHOST=127.0.0.1
export PGPORT=55437
export PGUSER=arturo
DB="tcp_test_r5schema_migration_${$}"
RUNNER_DIR="$(mktemp -d /tmp/tcp-r5-prisma-atomicity.XXXXXX)"
PGDATABASE=postgres createdb "$DB"
cleanup() {
  PGDATABASE=postgres dropdb --if-exists "$DB"
  python3 -c 'import pathlib, shutil, sys; p=pathlib.Path(sys.argv[1]); assert p.parent == pathlib.Path("/tmp"); shutil.rmtree(p)' "$RUNNER_DIR"
}
trap cleanup EXIT

psql_base=(psql -X -v ON_ERROR_STOP=1 -d "$DB")

bootstrap() {
  local schema="$1"
  "${psql_base[@]}" -v schema="$schema" <<'SQL'
CREATE SCHEMA IF NOT EXISTS :"schema";
SET search_path TO :"schema";
CREATE TABLE "tenants" ("tenantId" TEXT PRIMARY KEY);
CREATE TABLE "Vendor" ("vendorId" TEXT PRIMARY KEY);
CREATE TABLE "Cliente" ("clienteId" TEXT PRIMARY KEY);
CREATE TABLE "CuentaPorCobrar" ("id" TEXT PRIMARY KEY);
CREATE TABLE "GastoCompra" (
  "gastoCompraId" TEXT PRIMARY KEY,
  "tenantId" TEXT
);
CREATE TABLE "GastosDE" (
  "gastosDEId" TEXT PRIMARY KEY,
  "tenantId" TEXT
);
CREATE TABLE "Empleado" (
  "empleadoId" TEXT PRIMARY KEY,
  "tenantId" TEXT
);
CREATE TABLE "Pagosalario" (
  "pgId" TEXT PRIMARY KEY,
  "empleadoId" TEXT NOT NULL
);
CREATE TABLE "CuentaPorPagar" (
  "cuentaPorPagarId" TEXT PRIMARY KEY,
  "gastoCompraId" TEXT,
  "gastosDEId" TEXT
);
CREATE TABLE "CompraProducto" (
  "compraProductoId" TEXT PRIMARY KEY,
  "gastoCompraId" TEXT,
  "cuentaPorPagarId" TEXT
);
CREATE TABLE "CompraDocumento" (
  "compraDocumentoId" TEXT PRIMARY KEY,
  "tenantId" TEXT,
  "cuentaPorPagarId" TEXT
);
CREATE TABLE "ReconciliacionVenta" ("ventaId" TEXT NOT NULL);
SQL
}

apply_migration() {
  local schema="$1"
  psql -X -1 -v ON_ERROR_STOP=1 -d "$DB" \
    -c "SET search_path TO \"$schema\"" \
    -f "$(dirname "$0")/migration.sql"
}

assert_failed_rollback() {
  local schema="$1"
  local expected="$2"
  local purchase_tenant_baseline="${3:-absent}"
  local expected_purchase_tenant="${4:-}"
  local payroll_tenant_baseline="${5:-absent}"
  local expected_payroll_tenant="${6:-}"
  local output
  output="$(mktemp)"
  if apply_migration "$schema" >"$output" 2>&1; then
    cat "$output"
    rm -f "$output"
    echo "Expected migration to reject $schema fixture" >&2
    return 1
  fi
  if ! grep -Fq "$expected" "$output"; then
    cat "$output"
    rm -f "$output"
    echo "Migration failed for an unexpected reason in $schema fixture" >&2
    return 1
  fi
  rm -f "$output"

  "${psql_base[@]}" -v schema="$schema" <<'SQL'
SET search_path TO :"schema";
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'CuentaPorPagar'
      AND column_name = 'tenantId'
  ) OR to_regclass('"DeudaCash"') IS NOT NULL THEN
    RAISE EXCEPTION 'Failed migration did not roll back its schema changes';
  END IF;
  IF (SELECT COUNT(*) FROM "CuentaPorPagar") <> 1 THEN
    RAISE EXCEPTION 'Failed migration changed its source fixture rows';
  END IF;
END $$;
SQL
  local purchase_column
  purchase_column="$("${psql_base[@]}" -Atc \
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = '$schema' AND table_name = 'CompraProducto' AND column_name = 'tenantId')")"
  if [[ "$purchase_tenant_baseline" == "absent" && "$purchase_column" != "f" ]]; then
    echo "Failed migration did not roll back CompraProducto.tenantId" >&2
    return 1
  fi
  if [[ "$purchase_tenant_baseline" == "present" ]]; then
    local purchase_tenant_after
    purchase_tenant_after="$("${psql_base[@]}" -Atc \
      "SELECT \"tenantId\" FROM \"$schema\".\"CompraProducto\" WHERE \"compraProductoId\" = 'purchase_conflict' OR \"compraProductoId\" = 'purchase_unverifiable' ORDER BY 1 LIMIT 1")"
    if [[ "$purchase_tenant_after" != "$expected_purchase_tenant" ]]; then
      echo "Failed migration changed existing CompraProducto tenant data" >&2
      return 1
    fi
  fi
  local payroll_column
  payroll_column="$(${psql_base[@]} -Atc \
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = '$schema' AND table_name = 'Pagosalario' AND column_name = 'tenantId')")"
  if [[ "$payroll_tenant_baseline" == "absent" && "$payroll_column" != "f" ]]; then
    echo "Failed migration did not roll back Pagosalario.tenantId" >&2
    return 1
  fi
  if [[ "$payroll_tenant_baseline" == "present" ]]; then
    local payroll_tenant_after
    payroll_tenant_after="$(${psql_base[@]} -Atc \
      "SELECT \"tenantId\" FROM \"$schema\".\"Pagosalario\" WHERE \"pgId\" = 'payroll_conflict'")"
    if [[ "$payroll_tenant_after" != "$expected_payroll_tenant" ]]; then
      echo "Failed migration changed existing Pagosalario tenant data" >&2
      return 1
    fi
  fi
}

# Valid reverse CompraProducto -> CuentaPorPagar mapping is derived from its
# linked GastoCompra tenant, never from Vendor.
bootstrap valid_mapping
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET search_path TO valid_mapping;
INSERT INTO "tenants" VALUES ('tenant_a');
INSERT INTO "GastoCompra" VALUES ('expense_a', 'tenant_a');
INSERT INTO "GastosDE" VALUES ('expense_de', 'tenant_a');
INSERT INTO "Empleado" VALUES ('employee_a', 'tenant_a');
INSERT INTO "Pagosalario" ("pgId", "empleadoId") VALUES ('payroll_a', 'employee_a');
INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "gastoCompraId")
VALUES ('payable_gasto', 'expense_a');
INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "gastosDEId")
VALUES ('payable_service', 'expense_de');
INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId")
VALUES ('payable_purchase'), ('payable_document');
INSERT INTO "CompraProducto" VALUES ('purchase_a', 'expense_a', 'payable_purchase');
INSERT INTO "CompraDocumento" VALUES ('document_a', 'tenant_a', 'payable_document');
SQL
apply_migration valid_mapping
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET search_path TO valid_mapping;
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "CuentaPorPagar" WHERE "tenantId" = 'tenant_a') <> 4 THEN
    RAISE EXCEPTION 'One or more valid parent tenant mappings were not applied';
  END IF;
  IF (SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'CuentaPorPagar'
        AND column_name = 'tipoDeuda') <> 'YES' THEN
    RAISE EXCEPTION 'CuentaPorPagar.tipoDeuda must be nullable';
  END IF;
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'CuentaPorPagar'
        AND column_name = 'tipoDeuda') <> 'text' THEN
    RAISE EXCEPTION 'CuentaPorPagar.tipoDeuda must use TEXT storage';
  END IF;
  IF EXISTS (SELECT 1 FROM "CuentaPorPagar" WHERE "tipoDeuda" IS NOT NULL) THEN
    RAISE EXCEPTION 'Migration must not invent CuentaPorPagar.tipoDeuda values';
  END IF;
  IF (SELECT "tenantId" FROM "CompraProducto" WHERE "compraProductoId" = 'purchase_a') <> 'tenant_a' THEN
    RAISE EXCEPTION 'CompraProducto tenant mapping was not applied';
  END IF;
  IF (SELECT "tenantId" FROM "Pagosalario" WHERE "pgId" = 'payroll_a') <> 'tenant_a' THEN
    RAISE EXCEPTION 'Pagosalario tenant mapping was not applied from Empleado';
  END IF;
  IF (SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'Pagosalario'
        AND column_name = 'tenantId') <> 'NO' THEN
    RAISE EXCEPTION 'Pagosalario.tenantId must be non-null';
  END IF;
  IF (SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'ReconciliacionVenta'
        AND column_name = 'ventaId') <> 'YES' THEN
    RAISE EXCEPTION 'ReconciliacionVenta.ventaId must be nullable';
  END IF;
  IF (SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'ReconciliacionVenta'
        AND column_name IN ('deudaCashId', 'prestamoCashId', 'tipoReconciliacion')) <> 3 THEN
    RAISE EXCEPTION 'ReconciliacionVenta fields are incomplete';
  END IF;
  IF to_regclass('"DeudaCash"') IS NULL OR to_regclass('"PrestamoCash"') IS NULL
      OR to_regclass('periodo_cache') IS NULL THEN
    RAISE EXCEPTION 'Cash and period-cache tables are incomplete';
  END IF;
  IF (SELECT COUNT(*) FROM pg_constraint
      WHERE connamespace = current_schema()::regnamespace
        AND conname = ANY(ARRAY[
          'CompraProducto_tenantId_fkey', 'CuentaPorPagar_tenantId_fkey',
          'Pagosalario_tenantId_fkey',
          'DeudaCash_tenantId_fkey', 'DeudaCash_proveedorId_fkey',
          'DeudaCash_cuentaPorPagarId_fkey', 'PrestamoCash_tenantId_fkey',
          'PrestamoCash_clienteId_fkey', 'PrestamoCash_cuentaPorCobrarId_fkey',
          'ReconciliacionVenta_deudaCashId_fkey',
          'ReconciliacionVenta_prestamoCashId_fkey'
        ])) <> 11 THEN
    RAISE EXCEPTION 'One or more tenant/cash reconciliation FKs are missing';
  END IF;
  IF (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = current_schema()
      AND indexname = ANY(ARRAY[
        'CompraProducto_tenantId_idx', 'CuentaPorPagar_tenantId_idx',
        'Pagosalario_tenantId_idx',
        'DeudaCash_cuentaPorPagarId_key', 'DeudaCash_tenantId_idx',
        'DeudaCash_proveedorId_idx', 'DeudaCash_estado_idx',
        'PrestamoCash_cuentaPorCobrarId_key', 'PrestamoCash_tenantId_idx',
        'PrestamoCash_clienteId_idx', 'PrestamoCash_estado_idx',
        'periodo_cache_tenantId_expiresAt_idx', 'periodo_cache_expiresAt_idx'
      ])) <> 13 THEN
    RAISE EXCEPTION 'One or more schema contract indexes are missing';
  END IF;
  IF (SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'DeudaCash') <> 17
      OR (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'PrestamoCash') <> 18
      OR (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'periodo_cache') <> 6 THEN
    RAISE EXCEPTION 'A cash/cache table does not match its complete Prisma column contract';
  END IF;
END $$;
SQL

# The additive nullable column must also preserve any values already present
# in a database where the Prisma field was deployed independently.
bootstrap existing_tipo_deuda
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET search_path TO existing_tipo_deuda;
INSERT INTO "tenants" VALUES ('tenant_a');
INSERT INTO "GastoCompra" VALUES ('expense_a', 'tenant_a');
ALTER TABLE "CuentaPorPagar" ADD COLUMN "tipoDeuda" TEXT;
INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "gastoCompraId", "tipoDeuda")
VALUES ('payable_existing_type', 'expense_a', 'FINANCIAMIENTO');
SQL
apply_migration existing_tipo_deuda
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET search_path TO existing_tipo_deuda;
DO $$
BEGIN
  IF (SELECT "tipoDeuda" FROM "CuentaPorPagar"
      WHERE "cuentaPorPagarId" = 'payable_existing_type') <> 'FINANCIAMIENTO' THEN
    RAISE EXCEPTION 'Migration overwrote an existing CuentaPorPagar.tipoDeuda value';
  END IF;
END $$;
SQL

# Conflicting authoritative parents must reject and roll back all added DDL.
bootstrap ambiguous_mapping
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET search_path TO ambiguous_mapping;
INSERT INTO "tenants" VALUES ('tenant_a'), ('tenant_b');
INSERT INTO "GastoCompra" VALUES ('expense_a', 'tenant_a');
INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "gastoCompraId")
VALUES ('payable_conflict', 'expense_a');
INSERT INTO "CompraDocumento" VALUES ('document_b', 'tenant_b', 'payable_conflict');
SQL
assert_failed_rollback ambiguous_mapping 'ambiguous=1'

# A dangling direct pointer must fail even if another parent resolves the tenant.
bootstrap dangling_direct
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET search_path TO dangling_direct;
INSERT INTO "tenants" VALUES ('tenant_a');
INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "gastoCompraId")
VALUES ('payable_dangling', 'missing_expense');
INSERT INTO "CompraDocumento" VALUES ('document_valid', 'tenant_a', 'payable_dangling');
SQL
assert_failed_rollback dangling_direct 'direct_source_missing=1'

# A linked authoritative parent with NULL tenant scope must fail even when
# another linked source has a valid tenant.
bootstrap null_source_tenant
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET search_path TO null_source_tenant;
INSERT INTO "tenants" VALUES ('tenant_a');
INSERT INTO "GastoCompra" VALUES ('expense_null', NULL);
INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "gastoCompraId")
VALUES ('payable_null_source', 'expense_null');
INSERT INTO "CompraDocumento" VALUES ('document_valid', 'tenant_a', 'payable_null_source');
SQL
assert_failed_rollback null_source_tenant 'source_tenant_missing=1'

# Preexisting CompraProducto scope must agree with a verifiable GastoCompra parent.
bootstrap purchase_scope_conflict
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET search_path TO purchase_scope_conflict;
ALTER TABLE "CompraProducto" ADD COLUMN "tenantId" TEXT;
INSERT INTO "tenants" VALUES ('tenant_a'), ('tenant_b');
INSERT INTO "GastoCompra" VALUES ('expense_a', 'tenant_a');
INSERT INTO "CompraProducto" VALUES ('purchase_conflict', 'expense_a', NULL, 'tenant_b');
INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId") VALUES ('payable_conflict');
SQL
assert_failed_rollback purchase_scope_conflict 'tenant_mismatch=1' present tenant_b

# A preexisting purchase tenant with no GastoCompra parent is unverifiable.
bootstrap purchase_scope_unverifiable
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET search_path TO purchase_scope_unverifiable;
ALTER TABLE "CompraProducto" ADD COLUMN "tenantId" TEXT;
INSERT INTO "tenants" VALUES ('tenant_a');
INSERT INTO "CompraProducto" VALUES ('purchase_unverifiable', NULL, NULL, 'tenant_a');
INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId") VALUES ('payable_unverifiable');
SQL
assert_failed_rollback purchase_scope_unverifiable 'tenant_unverifiable=1' present tenant_a

# No linked, authoritative source is also a hard failure and is rolled back.
bootstrap unmapped
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET search_path TO unmapped;
INSERT INTO "tenants" VALUES ('tenant_a');
INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId") VALUES ('payable_unmapped');
SQL
assert_failed_rollback unmapped 'unmapped=1'

# Run the exact R5 migration through this repository's installed Prisma runner
# and force its reference preflight to fail after the first DDL statement.
mkdir -p "$RUNNER_DIR/migrations/20260928000000_test_baseline"
cat > "$RUNNER_DIR/schema.prisma" <<'PRISMA'
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
PRISMA
cat > "$RUNNER_DIR/migrations/migration_lock.toml" <<'TOML'
provider = "postgresql"
TOML
cat > "$RUNNER_DIR/migrations/20260928000000_test_baseline/migration.sql" <<'SQL'
SELECT 1;
SQL
psql -X -v ON_ERROR_STOP=1 -d "$DB" -c 'CREATE SCHEMA prisma_runner_failure'
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PRISMA_CLI="$ROOT/node_modules/prisma/build/index.js"
RUNNER_OUTPUT="$RUNNER_DIR/deploy.out"
(
  cd "$RUNNER_DIR"
  DATABASE_URL="postgresql://arturo@127.0.0.1:55437/$DB?schema=prisma_runner_failure" \
    DIRECT_URL="postgresql://arturo@127.0.0.1:55437/$DB?schema=prisma_runner_failure" \
    node "$PRISMA_CLI" migrate deploy --schema "$RUNNER_DIR/schema.prisma"
) >"$RUNNER_OUTPUT" 2>&1

bootstrap prisma_runner_failure
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET search_path TO prisma_runner_failure;
INSERT INTO "tenants" VALUES ('tenant_a');
INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId", "gastoCompraId")
VALUES ('payable_runner_failure', 'missing_expense');
INSERT INTO "CompraDocumento" VALUES ('document_valid', 'tenant_a', 'payable_runner_failure');
SQL
mkdir -p "$RUNNER_DIR/migrations/20260929000000_r5_formal_schema_dependencies"
cp "$(dirname "$0")/migration.sql" \
  "$RUNNER_DIR/migrations/20260929000000_r5_formal_schema_dependencies/migration.sql"
set +e
(
  cd "$RUNNER_DIR"
  DATABASE_URL="postgresql://arturo@127.0.0.1:55437/$DB?schema=prisma_runner_failure" \
    DIRECT_URL="postgresql://arturo@127.0.0.1:55437/$DB?schema=prisma_runner_failure" \
    node "$PRISMA_CLI" migrate deploy --schema "$RUNNER_DIR/schema.prisma"
) >"$RUNNER_OUTPUT" 2>&1
runner_status=$?
set -e
if [[ "$runner_status" -eq 0 ]] || ! grep -Fq 'direct_source_missing=1' "$RUNNER_OUTPUT"; then
  cat "$RUNNER_OUTPUT"
  echo 'Expected Prisma deploy of the exact R5 migration to reject the dangling reference' >&2
  exit 1
fi
runner_rollback="$(psql -X -At -d "$DB" -c \
  "SELECT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'prisma_runner_failure' AND table_name = 'CompraProducto' AND column_name = 'tenantId') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'prisma_runner_failure' AND table_name = 'CuentaPorPagar' AND column_name = 'tenantId') AND to_regclass('prisma_runner_failure.\"DeudaCash\"') IS NULL AND (SELECT COUNT(*) FROM prisma_runner_failure.\"CuentaPorPagar\") = 1 AND (SELECT \"gastoCompraId\" FROM prisma_runner_failure.\"CuentaPorPagar\" WHERE \"cuentaPorPagarId\" = 'payable_runner_failure') = 'missing_expense'")"
if [[ "$runner_rollback" != "t" ]]; then
  echo 'Prisma deploy left DDL or changed fixture data after exact R5 migration failure' >&2
  exit 1
fi

# Existing payroll scope that disagrees with its canonical employee is rejected
# without changing its data or leaving the additive DDL behind.
bootstrap payroll_scope_conflict
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET search_path TO payroll_scope_conflict;
INSERT INTO "tenants" VALUES ('tenant_a'), ('tenant_b');
INSERT INTO "Empleado" VALUES ('employee_a', 'tenant_a');
ALTER TABLE "Pagosalario" ADD COLUMN "tenantId" TEXT;
INSERT INTO "Pagosalario" VALUES ('payroll_conflict', 'employee_a', 'tenant_b');
INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId") VALUES ('payable_conflict');
SQL
assert_failed_rollback payroll_scope_conflict 'payroll_tenant_mismatch=1' absent '' present tenant_b

# Missing canonical employee or employee tenant is not a safe payroll scope.
bootstrap payroll_missing_employee
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET search_path TO payroll_missing_employee;
INSERT INTO "Pagosalario" ("pgId", "empleadoId") VALUES ('payroll_orphan', 'missing_employee');
INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId") VALUES ('payable_orphan');
SQL
assert_failed_rollback payroll_missing_employee 'payroll_employee_missing=1'

bootstrap payroll_employee_tenant_null
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET search_path TO payroll_employee_tenant_null;
INSERT INTO "Empleado" VALUES ('employee_null_tenant', NULL);
INSERT INTO "Pagosalario" ("pgId", "empleadoId")
VALUES ('payroll_null_tenant', 'employee_null_tenant');
INSERT INTO "CuentaPorPagar" ("cuentaPorPagarId") VALUES ('payable_null_tenant');
SQL
assert_failed_rollback payroll_employee_tenant_null 'payroll_employee_tenant_missing=1'

echo 'R5 schema migration tests passed (valid payroll mapping, fail-closed rollback, exact R5 Prisma runner rollback).'
