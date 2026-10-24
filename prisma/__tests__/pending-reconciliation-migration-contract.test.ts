import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrations = [
  '20261022000000_add_cost_history_vendor_sequence_custom_contract',
  '20261022130000_add_production_vales_and_history',
  '20261022140000_add_review_tables',
  '20261022150000_scope_custom_contract_types',
].map((name) =>
  readFileSync(resolve(process.cwd(), `prisma/migrations/${name}/migration.sql`), 'utf8'),
);

describe('pending reconciliation migration safety contract', () => {
  it('wraps every pending migration in a transaction with a bounded lock timeout', () => {
    for (const sql of migrations) {
      expect(sql.trimStart()).toMatch(/^BEGIN;/);
      expect(sql).toMatch(/SET LOCAL lock_timeout\s*=\s*'5s'/);
      expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    }
  });

  it('binds M2 and M3 named constraint checks to the expected relation and type', () => {
    for (const sql of migrations.slice(1, 3)) {
      expect(sql).toMatch(/conrelid\s*=\s*'"(?:ValeSalidaItem|reviews|review_prompts)"'::regclass/);
      expect(sql).toMatch(/contype\s*=\s*'f'/);
      expect(sql).toContain('convalidated');
      expect(sql).toContain('conkey');
      expect(sql).toContain('confkey');
      expect(sql).toContain('confupdtype');
      expect(sql).toContain('confdeltype');
      expect(sql).toContain('pg_get_constraintdef');
    }
  });

  it('validates the M4 tenant foreign key by relation, type, ordered keys, actions, and state', () => {
    const sql = migrations[3];
    expect(sql).toContain('c.conrelid=target_relation');
    expect(sql).toContain("c.contype='f'");
    expect(sql).toContain('c.conkey=ARRAY[tenant_att]::smallint[]');
    expect(sql).toContain('c.confrelid=tenant_relation');
    expect(sql).toContain('c.confkey=ARRAY[tenant_ref_att]::smallint[]');
    expect(sql).toContain("c.confupdtype='c'");
    expect(sql).toContain("c.confdeltype='n'");
    expect(sql).toContain('c.convalidated');
    expect(sql).toContain('NOT c.condeferrable');
    expect(sql).toContain('NOT c.condeferred');
    expect(sql).toContain('pg_get_constraintdef(c.oid)');
  });

  it('adds tenant/source fields without assigning inferred tenants or dropping legacy data', () => {
    expect(migrations[1]).toContain('ADD COLUMN "sourceTipoUbicacion" text');
    expect(migrations[1]).toContain('ADD COLUMN "sourceUbicacionId" text');
    expect(migrations[3]).toMatch(/ADD COLUMN "tenantId" TEXT/);
    expect(migrations[3]).not.toMatch(/UPDATE\s+"TipoContratoCustom"/i);
    expect(migrations[3]).toContain('CREATE UNIQUE INDEX "TipoContratoCustom_tenantId_nombre_key"');
    expect(migrations[3]).toContain('DROP INDEX "TipoContratoCustom_nombre_key"');
    for (const sql of migrations) {
      expect(sql).not.toMatch(/\b(?:TRUNCATE|DELETE FROM)\b/i);
    }
  });
});
