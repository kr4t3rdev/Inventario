import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20261106000000_add_tenant_id_to_orden_reparacion/migration.sql',
)

describe('OrdenReparacion tenant ownership migration contract', () => {
  it('backfills ownership from the related client and enforces tenant integrity', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toMatch(/ALTER TABLE "OrdenReparacion"\s+ADD COLUMN IF NOT EXISTS "tenantId" TEXT/)
    expect(sql).toMatch(/UPDATE "OrdenReparacion"[\s\S]*FROM "Cliente"/)
    expect(sql).toMatch(/orden\."clienteId"\s*=\s*cliente\."clienteId"/)
    expect(sql).toMatch(/ALTER TABLE "OrdenReparacion"\s+ALTER COLUMN "tenantId" SET NOT NULL/)
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "OrdenReparacion_tenantId_idx"')
    expect(sql).toMatch(/FOREIGN KEY \("tenantId"\) REFERENCES "tenants"\s*\("tenantId"\)/)
    expect(sql).toContain('RAISE EXCEPTION')
  })
})
