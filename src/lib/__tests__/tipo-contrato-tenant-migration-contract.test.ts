/**
 * @description Verifies the data-preserving tenant ownership expansion for custom contract types.
 * @param {void} No aplica - suite de contrato de migración
 * @returns {void} Aserciones vitest
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20261022150000_scope_custom_contract_types/migration.sql',
)

describe('TipoContratoCustom tenant ownership migration contract', () => {
  it('adds nullable ownership without attributing legacy rows and replaces global uniqueness safely', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toMatch(/ALTER TABLE "TipoContratoCustom"\s+ADD COLUMN "tenantId" TEXT/)
    expect(sql).toContain(
      'FOREIGN KEY ("tenantId") REFERENCES tenants("tenantId") ON DELETE SET NULL ON UPDATE CASCADE',
    )
    expect(sql).toContain(
      'pg_get_constraintdef(c.oid)=\'FOREIGN KEY ("tenantId") REFERENCES tenants("tenantId") ON UPDATE CASCADE ON DELETE SET NULL\'',
    )
    expect(sql).toContain("c.contype='f'")
    expect(sql).toContain('c.convalidated')
    expect(sql).toContain('CREATE INDEX "TipoContratoCustom_tenantId_idx"')
    expect(sql).toContain('CREATE UNIQUE INDEX "TipoContratoCustom_tenantId_nombre_key"')
    expect(sql).toContain('DROP INDEX "TipoContratoCustom_nombre_key"')
    expect(sql).toContain('pg_constraint')
    expect(sql).toContain('"TipoContratoCustom"')
    expect(sql).not.toMatch(/\bUPDATE\s+"TipoContratoCustom"\b/i)
    expect(sql).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN|TYPE)\b/i)
    // Catalog guards make the migration safe to resume without weakening the
    // tenant FK or tenant-scoped uniqueness contract.
    expect(sql).toContain("IF EXISTS (\n   SELECT 1 FROM pg_constraint c")
    expect(sql.indexOf('CREATE UNIQUE INDEX "TipoContratoCustom_tenantId_nombre_key"'))
      .toBeLessThan(sql.indexOf('DROP INDEX "TipoContratoCustom_nombre_key"'))
  })
})
