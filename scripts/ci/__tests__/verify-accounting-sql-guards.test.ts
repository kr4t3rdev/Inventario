import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts/ci/verify-accounting-sql-guards.mjs');

describe('verify-accounting-sql-guards', () => {
  it('comprueba triggers y constraints SQL críticos en la base de destino', () => {
    const result = spawnSync(process.execPath, [script, '--print-sql'], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    for (const guard of [
      'stock_move_line_no_update',
      'stock_move_line_no_delete',
      'apertura_revisiones_protect_lifecycle',
      'apertura_revisiones_lineas_immutable',
      'contab_replay_approval_different_actor_check',
      'contab_replay_preflight_24h_expiry_check',
      'lineas_apertura_periodo_fx_evidence_complete_check',
      'fx_evidence_immutable_update',
      'financial_auxiliary_checkpoints_immutable_update',
      'tenant_accounting_policy_currency_immutable_after_evidence',
      'ReconciliacionServicio_idempotencyPair_check',
      'ReconciliacionServicio_accountAmountPair_check',
      'ReconciliacionServicio_sourceAccountAmountPair_check',
      'ReconciliacionVenta_accountAmountPair_check',
      'ReconciliacionVenta_sourceAccountAmountPair_check',
    ]) {
      expect(result.stdout).toContain(guard);
    }
  });

  it('CI despliega migraciones antes de verificar los guards SQL', () => {
    const workflow = readFileSync(join(process.cwd(), '.github/workflows/integration.yml'), 'utf8');
    const deployIndex = workflow.indexOf('run: pnpm exec prisma migrate deploy');
    const verifyIndex = workflow.indexOf('run: node scripts/ci/verify-accounting-sql-guards.mjs');

    expect(deployIndex).toBeGreaterThanOrEqual(0);
    expect(verifyIndex).toBeGreaterThan(deployIndex);
  });
});
