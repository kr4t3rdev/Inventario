/**
 * @description Unit tests for RestoreEngine — pure logic only (parseSql, classify, countInsertRows, etc.)
 * DB-dependent integration tests are kept separate.
 */
import { describe, it, expect } from 'vitest'
import { RestoreEngine } from '../restore-engine'
import type { BackupStorage } from '../storage/types'

// Create a minimal storage that throws if used (we only test pure parsing)
const mockStorage: BackupStorage = {
  save: async () => { throw new Error('Not used in unit tests') },
  get: async () => { throw new Error('Not used in unit tests') },
  delete: async () => { throw new Error('Not used in unit tests') },
  list: async () => { throw new Error('Not used in unit tests') },
  getDownloadUrl: async () => { throw new Error('Not used in unit tests') },
  getFileName: () => { throw new Error('Not used in unit tests') },
}

// Create engine instance without pool (only testing pure parser methods)
function createEngine(): RestoreEngine {
  return new (RestoreEngine as any)({ storage: mockStorage })
}

// ─── SQL Parsing ────────────────────────────────────────────

describe('RestoreEngine.parseSql', () => {
  it('splits simple statements by semicolon', () => {
    const engine = createEngine()
    const sql = `CREATE TABLE "Test" (id int);
INSERT INTO "Test" VALUES (1);
CREATE INDEX idx ON "Test" (id);`

    const stmts = engine.parseSql(sql)
    expect(stmts).toHaveLength(3)
    expect(stmts[0].type).toBe('create_table')
    expect(stmts[0].tableName).toBe('Test')
    expect(stmts[1].type).toBe('insert')
    expect(stmts[1].tableName).toBe('Test')
    expect(stmts[2].type).toBe('create_index')
    expect(stmts[2].tableName).toBe('Test')
  })

  it('does not split on semicolons inside string literals', () => {
    const engine = createEngine()
    const sql = `INSERT INTO "Items" (name) VALUES ('hello; world');`

    const stmts = engine.parseSql(sql)
    expect(stmts).toHaveLength(1)
    expect(stmts[0].type).toBe('insert')
  })

  it('handles multiline INSERT with string containing semicolons', () => {
    const engine = createEngine()
    const sql = `INSERT INTO "Log" (msg) VALUES (
  'line1; still same;'
);`

    const stmts = engine.parseSql(sql)
    expect(stmts).toHaveLength(1)
    expect(stmts[0].type).toBe('insert')
  })

  it('skips comment lines', () => {
    const engine = createEngine()
    const sql = `-- This is a comment
INSERT INTO "T" VALUES (1);
-- Another comment`

    const stmts = engine.parseSql(sql)
    // Comments are preserved as 'comment' type
    expect(stmts.length).toBeGreaterThanOrEqual(1)
    expect(stmts.filter(s => s.type === 'comment')).toHaveLength(2)
    expect(stmts.filter(s => s.type === 'insert')).toHaveLength(1)
  })

  it('handles empty input gracefully', () => {
    const engine = createEngine()
    const stmts = engine.parseSql('')
    expect(stmts).toHaveLength(0)
  })

  it('handles input with only whitespace', () => {
    const engine = createEngine()
    const stmts = engine.parseSql('   \n  \n  ')
    expect(stmts).toHaveLength(0)
  })

  it('classifies SET statements correctly', () => {
    const engine = createEngine()
    const stmts = engine.parseSql("SET session_replication_role = replica;")
    expect(stmts).toHaveLength(1)
    expect(stmts[0].type).toBe('set_config')
  })

  it('classifies FK disable/enable statements', () => {
    const engine = createEngine()
    const sql = `-- Disable triggers
SET session_replication_role = replica;
-- Enable triggers
SET session_replication_role = DEFAULT;`

    const stmts = engine.parseSql(sql)
    expect(stmts.filter(s => s.type === 'set_config')).toHaveLength(2)
  })

  it('parses a realistic multi-table backup dump', () => {
    const engine = createEngine()
    const sql = `-- Backup: full
SET session_replication_role = replica;
-- Table: Tenant
CREATE TABLE "Tenant" ("tenantId" text PRIMARY KEY, name text);
CREATE INDEX idx_tenant_name ON "Tenant" (name);
INSERT INTO "Tenant" VALUES ('t1', 'Acme');
INSERT INTO "Tenant" VALUES ('t2', 'Globex');
-- Table: User
CREATE TABLE "User" ("userId" text PRIMARY KEY, "tenantId" text REFERENCES "Tenant");
INSERT INTO "User" VALUES ('u1', 't1');
SET session_replication_role = DEFAULT;`

    const stmts = engine.parseSql(sql)
    const createTables = stmts.filter(s => s.type === 'create_table')
    const inserts = stmts.filter(s => s.type === 'insert')
    const indexes = stmts.filter(s => s.type === 'create_index')

    expect(createTables).toHaveLength(2)
    expect(createTables[0].tableName).toBe('Tenant')
    expect(createTables[1].tableName).toBe('User')

    expect(inserts).toHaveLength(3)
    expect(inserts[0].tableName).toBe('Tenant')
    expect(inserts[1].tableName).toBe('Tenant')
    expect(inserts[2].tableName).toBe('User')

    expect(indexes).toHaveLength(1)
    expect(indexes[0].tableName).toBe('Tenant')

    expect(stmts.filter(s => s.type === 'set_config')).toHaveLength(2)
    expect(stmts.filter(s => s.type === 'comment')).toHaveLength(3)
  })
})

// ─── countInsertRows ────────────────────────────────────────

describe('countInsertRows', () => {
  it('counts single row', () => {
    const engine = createEngine()
    // Access private method via bracket notation
    const count = (engine as any).countInsertRows("INSERT INTO T VALUES (1);")
    expect(count).toBe(1)
  })

  it('counts multiple rows in one INSERT', () => {
    const engine = createEngine()
    const count = (engine as any).countInsertRows("INSERT INTO T VALUES (1, 'a'), (2, 'b'), (3, 'c');")
    expect(count).toBe(3)
  })

  it('handles nested parentheses in values', () => {
    const engine = createEngine()
    const count = (engine as any).countInsertRows(
      "INSERT INTO T VALUES (1, ARRAY[1,2,3]), (2, ARRAY[4,5,6]);"
    )
    // ARRAY brackets are not parentheses, should count 2
    expect(count).toBe(2)
  })

  it('handles strings with parentheses', () => {
    const engine = createEngine()
    const count = (engine as any).countInsertRows(
      "INSERT INTO T VALUES ('foo (bar) baz');"
    )
    expect(count).toBe(1)
  })

  it('returns 0 for INSERT without VALUES', () => {
    const engine = createEngine()
    const count = (engine as any).countInsertRows("INSERT INTO T SELECT * FROM S;")
    expect(count).toBe(0)
  })

  it('handles multiline VALUES', () => {
    const engine = createEngine()
    const count = (engine as any).countInsertRows(
      `INSERT INTO T (id, name) VALUES
(1, 'Alice'),
(2, 'Bob');`
    )
    expect(count).toBe(2)
  })
})

// ─── rewriteInsertOnConflict ────────────────────────────────

describe('rewriteInsertOnConflict', () => {
  it('adds ON CONFLICT DO NOTHING', () => {
    const engine = createEngine()
    const result = (engine as any).rewriteInsertOnConflict(
      "INSERT INTO T VALUES (1)"
    )
    expect(result).toBe("INSERT INTO T VALUES (1) ON CONFLICT DO NOTHING")
  })

  it('strips trailing semicolon before adding conflict clause', () => {
    const engine = createEngine()
    const result = (engine as any).rewriteInsertOnConflict(
      "INSERT INTO T VALUES (1);"
    )
    expect(result).toBe("INSERT INTO T VALUES (1) ON CONFLICT DO NOTHING")
  })

  it('handles INSERT with column list', () => {
    const engine = createEngine()
    const result = (engine as any).rewriteInsertOnConflict(
      'INSERT INTO "User" ("userId", name) VALUES (\'u1\', \'Alice\');'
    )
    expect(result).toBe(
      'INSERT INTO "User" ("userId", name) VALUES (\'u1\', \'Alice\') ON CONFLICT DO NOTHING'
    )
  })
})

// ─── extractTableName ───────────────────────────────────────

describe('extractTableName', () => {
  it('extracts from CREATE TABLE', () => {
    const engine = createEngine()
    const table = (engine as any).extractTableName(
      'CREATE TABLE "Tenant" ("id" text PRIMARY KEY);',
      'CREATE TABLE',
    )
    expect(table).toBe('Tenant')
  })

  it('extracts unquoted table name', () => {
    const engine = createEngine()
    const table = (engine as any).extractTableName(
      'CREATE TABLE Tenant (id int);',
      'CREATE TABLE',
    )
    expect(table).toBe('Tenant')
  })

  it('extracts from INSERT INTO', () => {
    const engine = createEngine()
    const table = (engine as any).extractTableName(
      'INSERT INTO "BackupLog" ("id") VALUES (\'abc\');',
      'INSERT INTO',
    )
    expect(table).toBe('BackupLog')
  })

  it('returns undefined when no match', () => {
    const engine = createEngine()
    const table = (engine as any).extractTableName(
      'SELECT 1;',
      'INSERT INTO',
    )
    expect(table).toBeUndefined()
  })
})

// ─── extractIndexTable ──────────────────────────────────────

describe('extractIndexTable', () => {
  it('extracts table name from CREATE INDEX', () => {
    const engine = createEngine()
    const table = (engine as any).extractIndexTable(
      'CREATE INDEX idx_name ON "User" (name);'
    )
    expect(table).toBe('User')
  })

  it('handles UNIQUE index', () => {
    const engine = createEngine()
    const table = (engine as any).extractIndexTable(
      'CREATE UNIQUE INDEX idx_email ON "User" (email);'
    )
    expect(table).toBe('User')
  })

  it('handles unquoted table name', () => {
    const engine = createEngine()
    const table = (engine as any).extractIndexTable(
      'CREATE INDEX idx ON Tenant (id);'
    )
    expect(table).toBe('Tenant')
  })

  it('returns undefined when no ON clause', () => {
    const engine = createEngine()
    const table = (engine as any).extractIndexTable(
      'SELECT 1;'
    )
    expect(table).toBeUndefined()
  })
})
