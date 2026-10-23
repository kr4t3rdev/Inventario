import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20261022000000_add_cost_history_vendor_sequence_custom_contract/migration.sql',
)

describe('first additive cost schema migration contract', () => {
  it('creates only the approved enum and runtime tables without destructive DDL', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('CREATE TYPE "CostChangeReason" AS ENUM')
    expect(sql).toMatch(/'INITIAL',\s*'RESTOCK',\s*'ADJUSTMENT',\s*'CORRECTION',\s*'IMPORT',\s*'MANUAL_EDIT',\s*'SYSTEM_SYNC'/)
    expect(sql).toContain('CREATE TABLE "ProductoCostHistory"')
    expect(sql).toContain('"oldPrecioCosto" INTEGER NOT NULL')
    expect(sql).toContain('"changedAt" TIMESTAMP(3) NOT NULL')
    expect(sql).toContain('CREATE TABLE "VendorCodeSequence"')
    expect(sql).toContain('"id" INTEGER NOT NULL DEFAULT 1')
    expect(sql).toContain('"nextNumber" INTEGER NOT NULL DEFAULT 1')
    expect(sql).toContain('CREATE TABLE "TipoContratoCustom"')
    expect(sql).toContain('"updatedAt" TIMESTAMP(3) NOT NULL')
    expect(sql).toContain('ProductoCostHistory_productoId_fkey')
    expect(sql).toContain('TipoContratoCustom_creadoPor_fkey')
    expect(sql).not.toContain('"tenantId"')
    expect(sql).not.toMatch(/\b(?:DROP|ALTER)\s+(?:TABLE|TYPE|COLUMN)\b/i)
    expect(sql).not.toMatch(/\bIF\s+NOT\s+EXISTS\b/i)
    expect(sql).not.toContain('BackupType')
    expect(sql).not.toContain('BackupStatus')
  })
})
