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
    expect(sql).toMatch(/CREATE TABLE(?: IF NOT EXISTS)? "ProductoCostHistory"/)
    expect(sql).toContain('"oldPrecioCosto" INTEGER NOT NULL')
    expect(sql).toContain('"changedAt" TIMESTAMP(3) NOT NULL')
    expect(sql).toMatch(/CREATE TABLE(?: IF NOT EXISTS)? "VendorCodeSequence"/)
    expect(sql).toContain('"id" INTEGER NOT NULL DEFAULT 1')
    expect(sql).toContain('"nextNumber" INTEGER NOT NULL DEFAULT 1')
    expect(sql).toMatch(/CREATE TABLE(?: IF NOT EXISTS)? "TipoContratoCustom"/)
    expect(sql).toContain('"updatedAt" TIMESTAMP(3) NOT NULL')
    expect(sql).toContain('ProductoCostHistory_productoId_fkey')
    expect(sql).toContain('TipoContratoCustom_creadoPor_fkey')
    const createdTables = [...sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? "([^"]+)" \(([\s\S]*?)\n\);/g)]
    expect(createdTables.map(([, tableName]) => tableName)).toEqual([
      'ProductoCostHistory',
      'VendorCodeSequence',
      'TipoContratoCustom',
    ])
    expect(createdTables.every(([, , definition]) => !definition.includes('"tenantId"'))).toBe(true)
    expect(sql).not.toMatch(/\b(?:DROP|ALTER)\s+(?:TABLE|TYPE|COLUMN)\b/i)
    // The migration is deliberately idempotent: table/index guards must not
    // obscure its additive-only DDL contract.
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "ProductoCostHistory"')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "VendorCodeSequence"')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "TipoContratoCustom"')
    expect(sql).not.toContain('BackupType')
    expect(sql).not.toContain('BackupStatus')
  })
})
