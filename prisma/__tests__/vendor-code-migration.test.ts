import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'prisma/migrations/20260430000000_repair_vendor_vendor_code/migration.sql',
);

describe('Vendor code repair migration', () => {
  it('does not require a legacy provider-code column that may already be absent', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('information_schema.columns');
    expect(sql).toContain("column_name = 'proveedorCodigo'");
    expect(sql).toContain('EXECUTE');
    expect(sql).toContain('Vendor_tenantId_vendorCode_key');
    expect(sql).toContain('pg_indexes');
  });
});
