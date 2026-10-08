import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const GUARD_SQL = String.raw`
DO $verify_accounting_guards$
DECLARE missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'stock_move_line_no_update' AND NOT tgisinternal) THEN
    missing := array_append(missing, 'stock_move_line_no_update');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'stock_move_line_no_delete' AND NOT tgisinternal) THEN
    missing := array_append(missing, 'stock_move_line_no_delete');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'apertura_revisiones_protect_lifecycle' AND NOT tgisinternal) THEN
    missing := array_append(missing, 'apertura_revisiones_protect_lifecycle');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'apertura_revisiones_lineas_immutable' AND NOT tgisinternal) THEN
    missing := array_append(missing, 'apertura_revisiones_lineas_immutable');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'snapshot_periodos_approved_immutable_update' AND NOT tgisinternal) THEN
    missing := array_append(missing, 'snapshot_periodos_approved_immutable_update');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'snapshot_periodos_approved_immutable_delete' AND NOT tgisinternal) THEN
    missing := array_append(missing, 'snapshot_periodos_approved_immutable_delete');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fx_evidence_immutable_update' AND NOT tgisinternal) THEN
    missing := array_append(missing, 'fx_evidence_immutable_update');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fx_evidence_immutable_delete' AND NOT tgisinternal) THEN
    missing := array_append(missing, 'fx_evidence_immutable_delete');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'financial_auxiliary_checkpoints_immutable_update' AND NOT tgisinternal) THEN
    missing := array_append(missing, 'financial_auxiliary_checkpoints_immutable_update');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'financial_auxiliary_checkpoints_immutable_delete' AND NOT tgisinternal) THEN
    missing := array_append(missing, 'financial_auxiliary_checkpoints_immutable_delete');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tenant_accounting_policy_currency_immutable_after_evidence' AND NOT tgisinternal) THEN
    missing := array_append(missing, 'tenant_accounting_policy_currency_immutable_after_evidence');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contab_replay_approval_different_actor_check') THEN
    missing := array_append(missing, 'contab_replay_approval_different_actor_check');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contab_replay_preflight_24h_expiry_check') THEN
    missing := array_append(missing, 'contab_replay_preflight_24h_expiry_check');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lineas_apertura_periodo_fx_evidence_complete_check') THEN
    missing := array_append(missing, 'lineas_apertura_periodo_fx_evidence_complete_check');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lineas_apertura_periodo_evidencia_sha256_check') THEN
    missing := array_append(missing, 'lineas_apertura_periodo_evidencia_sha256_check');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lineas_apertura_periodo_lado_check') THEN
    missing := array_append(missing, 'lineas_apertura_periodo_lado_check');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReconciliacionServicio_idempotencyPair_check') THEN
    missing := array_append(missing, 'ReconciliacionServicio_idempotencyPair_check');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReconciliacionServicio_accountAmountPair_check') THEN
    missing := array_append(missing, 'ReconciliacionServicio_accountAmountPair_check');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReconciliacionServicio_sourceAccountAmountPair_check') THEN
    missing := array_append(missing, 'ReconciliacionServicio_sourceAccountAmountPair_check');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReconciliacionVenta_accountAmountPair_check') THEN
    missing := array_append(missing, 'ReconciliacionVenta_accountAmountPair_check');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReconciliacionVenta_sourceAccountAmountPair_check') THEN
    missing := array_append(missing, 'ReconciliacionVenta_sourceAccountAmountPair_check');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'ReconciliacionServicio_tenantId_idempotencyKey_key'
  ) THEN
    missing := array_append(missing, 'ReconciliacionServicio_tenantId_idempotencyKey_key');
  END IF;

  IF cardinality(missing) > 0 THEN
    RAISE EXCEPTION 'Required accounting SQL guards are missing: %', array_to_string(missing, ', ');
  END IF;
END;
$verify_accounting_guards$;
`;

/**
 * @description Verifica que guardias SQL críticas estén aplicadas en la base actual.
 * @param {string} root - Raíz que contiene node_modules y prisma/schema.prisma.
 * @returns {void} Finaliza si existen todas las guardias requeridas.
 */
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function verifyAccountingSqlGuards(root = repositoryRoot) {
  const prismaBin = resolve(root, 'node_modules/.bin/prisma');
  const schemaPath = resolve(root, 'prisma/schema.prisma');
  if (!existsSync(prismaBin) || !existsSync(schemaPath)) {
    throw new Error('Prisma CLI y schema son requeridos para verificar las guardias SQL.');
  }

  const result = spawnSync(prismaBin, ['db', 'execute', '--stdin', '--schema', schemaPath], {
    cwd: root,
    encoding: 'utf8',
    input: GUARD_SQL,
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'No se pudieron verificar las guardias SQL.');
  }
}

async function main() {
  if (process.argv.includes('--print-sql')) {
    process.stdout.write(GUARD_SQL);
    return;
  }
  verifyAccountingSqlGuards();
  process.stdout.write('[db-guards] Required accounting SQL guards are present.\n');
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (entryUrl && import.meta.url === entryUrl) {
  try {
    await main();
  } catch (error) {
    console.error('[db-guards] Verification failed:', error);
    process.exitCode = 1;
  }
}
