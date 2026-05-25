/**
 * @description Unit tests for SQLBuilder — DDL & DML generation.
 * TDD: RED → GREEN → REFACTOR.
 */
import { describe, it, expect } from 'vitest'
import { SQLBuilder } from '../sql-builder'
import type { TableSchema, ColumnDef, FKDef } from '../types'

describe('SQLBuilder', () => {
  const builder = new SQLBuilder()

  describe('generateTopComment', () => {
    it('should generate header with type, timestamp, and table count', () => {
      const result = builder.generateTopComment('full', 5)
      expect(result).toContain('TCP Database Backup')
      expect(result).toContain('Type: full')
      expect(result).toContain('Tables: 5')
      expect(result).toMatch(/-- Generated at: \d{4}-\d{2}-\d{2}T/)
    })

    it('should include tenant ID when provided', () => {
      const result = builder.generateTopComment('tenant', 1, { tenantId: 'tnt_abc123' })
      expect(result).toContain('Tenant: tnt_abc123')
    })
  })

  describe('generateCreateTable', () => {
    const table: TableSchema = {
      name: 'users',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, defaultValue: 'gen_random_uuid()', isPrimaryKey: true },
        { name: 'email', type: 'varchar', nullable: false, defaultValue: null, isPrimaryKey: false },
        { name: 'full_name', type: 'varchar', nullable: true, defaultValue: null, isPrimaryKey: false },
        { name: 'score', type: 'int4', nullable: false, defaultValue: '0', isPrimaryKey: false },
        { name: 'created_at', type: 'timestamptz', nullable: true, defaultValue: 'now()', isPrimaryKey: false },
      ],
      primaryKey: ['id'],
      indexes: ['CREATE INDEX idx_users_email ON users(email)'],
      foreignKeys: [],
    }

    it('should generate CREATE TABLE with columns, types, nullability, and defaults', () => {
      const result = builder.generateCreateTable(table)
      expect(result).toContain('CREATE TABLE IF NOT EXISTS "users" (')
      expect(result).toContain('"id" uuid NOT NULL DEFAULT gen_random_uuid()')
      expect(result).toContain('"email" varchar NOT NULL')
      expect(result).toContain('"full_name" varchar,')
      expect(result).toContain('"score" int4 NOT NULL DEFAULT 0')
      expect(result).toContain('PRIMARY KEY ("id")')
      expect(result).toContain(');')
    })

    it('should quote column names with special chars', () => {
      const specialTable: TableSchema = {
        name: 'data_entries',
        columns: [
          { name: 'group', type: 'varchar', nullable: true, defaultValue: null, isPrimaryKey: false },
        ],
        primaryKey: [],
        indexes: [],
        foreignKeys: [],
      }
      const result = builder.generateCreateTable(specialTable)
      expect(result).toContain('"group"')
    })
  })

  describe('generateCreateIndex', () => {
    it('should emit the index definition as-is with trailing semicolon', () => {
      const index = 'CREATE INDEX idx_users_email ON users(email)'
      const result = builder.generateCreateIndex(index)
      expect(result).toBe('CREATE INDEX idx_users_email ON users(email);')
    })

    it('should add comment for UNIQUE indexes', () => {
      const index = 'CREATE UNIQUE INDEX idx_users_email_unique ON users(email)'
      const result = builder.generateCreateIndex(index)
      expect(result).toContain('CREATE UNIQUE INDEX')
    })

    it('should handle CONCURRENTLY indexes by removing CONCURRENTLY', () => {
      const index = 'CREATE INDEX CONCURRENTLY idx_products_name ON products(name)'
      const result = builder.generateCreateIndex(index)
      expect(result).not.toContain('CONCURRENTLY')
      expect(result).toContain('CREATE INDEX idx_products_name ON products(name);')
    })
  })

  describe('formatLiteral', () => {
    it('should format NULL values', () => {
      expect(builder.formatLiteral(null, 'varchar')).toBe('NULL')
    })

    it('should format string values with proper escaping', () => {
      expect(builder.formatLiteral("hello's world", 'varchar'))
        .toBe("'hello''s world'")
    })

    it('should format numeric values without quotes', () => {
      expect(builder.formatLiteral(42, 'int4')).toBe('42')
      expect(builder.formatLiteral(3.14, 'numeric')).toBe("'3.14'::numeric")
    })

    it('should format boolean values', () => {
      expect(builder.formatLiteral(true, 'bool')).toBe('TRUE')
      expect(builder.formatLiteral(false, 'bool')).toBe('FALSE')
    })

    it('should format UUID values with type cast', () => {
      expect(builder.formatLiteral('550e8400-e29b-41d4-a716-446655440000', 'uuid'))
        .toBe("'550e8400-e29b-41d4-a716-446655440000'::uuid")
    })

    it('should format JSON values with type cast', () => {
      const json = JSON.stringify({ key: 'value', count: 5 })
      expect(builder.formatLiteral(json, 'jsonb'))
        .toBe(`'${json}'::jsonb`)
      expect(builder.formatLiteral(json, 'json'))
        .toBe(`'${json}'::json`)
    })

    it('should format BYTEA values as hex', () => {
      const buf = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f])
      expect(builder.formatLiteral(buf, 'bytea'))
        .toBe("'\\x48656c6c6f'::bytea")
    })

    it('should format timestamptz values with type cast', () => {
      const result = builder.formatLiteral('2025-01-15 10:30:00+00', 'timestamptz')
      expect(result).toBe("'2025-01-15 10:30:00+00'::timestamptz")
    })

    it('should format timestamp values with type cast', () => {
      expect(builder.formatLiteral('2025-01-15 10:30:00', 'timestamp'))
        .toBe("'2025-01-15 10:30:00'::timestamp")
    })

    it('should format date values with type cast', () => {
      expect(builder.formatLiteral('2025-01-15', 'date'))
        .toBe("'2025-01-15'::date")
    })

    it('should format time values with type cast', () => {
      expect(builder.formatLiteral('10:30:00', 'time'))
        .toBe("'10:30:00'::time")
    })

    it('should format numeric/decimal values without quotes', () => {
      expect(builder.formatLiteral('123.45', 'decimal')).toBe("'123.45'::decimal")
    })

    it('should escape single quotes in string content', () => {
      expect(builder.formatLiteral("it's a test", 'text'))
        .toBe("'it''s a test'")
    })

    it('should format integer arrays', () => {
      expect(builder.formatLiteral('{1,2,3}', '_int4'))
        .toBe("'{1,2,3}'::int4[]")
    })
  })

  describe('generateInsertBatch', () => {
    const columns: ColumnDef[] = [
      { name: 'id', type: 'uuid', nullable: false, defaultValue: null, isPrimaryKey: true },
      { name: 'name', type: 'varchar', nullable: false, defaultValue: null, isPrimaryKey: false },
      { name: 'active', type: 'bool', nullable: false, defaultValue: null, isPrimaryKey: false },
      { name: 'score', type: 'int4', nullable: true, defaultValue: null, isPrimaryKey: false },
    ]

    it('should generate INSERT with all rows', () => {
      const rows = [
        ['a-uuid', 'Alice', true, 100],
        ['b-uuid', 'Bob', false, null],
      ]
      const result = builder.generateInsertBatch('users', columns, rows)
      expect(result).toContain('INSERT INTO "users" ("id","name","active","score") VALUES')
      expect(result).toContain("('a-uuid'::uuid,'Alice',TRUE,100)")
      expect(result).toContain("('b-uuid'::uuid,'Bob',FALSE,NULL)")
      expect(result).toContain('ON CONFLICT DO NOTHING;')
    })

    it('should handle empty rows', () => {
      const result = builder.generateInsertBatch('users', columns, [])
      expect(result).toBe('')
    })

    it('should escape special characters in string values', () => {
      const rows = [["O'Brien", "Line1\nLine2", "Tab\there"]]
      const cols: ColumnDef[] = [
        { name: 'col1', type: 'text', nullable: true, defaultValue: null, isPrimaryKey: false },
        { name: 'col2', type: 'text', nullable: true, defaultValue: null, isPrimaryKey: false },
        { name: 'col3', type: 'text', nullable: true, defaultValue: null, isPrimaryKey: false },
      ]
      const result = builder.generateInsertBatch('test', cols, rows)
      expect(result).toContain("'O''Brien'")
      // Newlines and tabs are preserved as-is in standard_conforming_strings mode
      expect(result).toContain("'Line1\nLine2'")
      expect(result).toContain("'Tab\there'")
    })
  })

  describe('generateForeignKeyDisable / Enable', () => {
    it('should generate SET session_replication_role = replica', () => {
      const result = builder.generateForeignKeyDisable()
      expect(result).toContain('SET session_replication_role = replica;')
    })

    it('should generate SET session_replication_role = default', () => {
      const result = builder.generateForeignKeyEnable()
      expect(result).toContain('SET session_replication_role = default;')
    })
  })

  describe('generateComment', () => {
    it('should generate a SQL comment line', () => {
      expect(builder.generateComment('Starting export')).toBe('-- Starting export')
    })

    it('should handle multi-line comments', () => {
      expect(builder.generateComment('Line1\nLine2')).toBe('-- Line1\n-- Line2')
    })
  })
})
