/**
 * @description SQLBuilder — generates SQL DDL and DML statements for backup dumps.
 * Pure class: no DB dependencies, operates on in-memory data structures.
 */
import type { TableSchema, ColumnDef } from './types'

export class SQLBuilder {
  /**
   * Generate the header comment for a backup file.
   */
  generateTopComment(type: string, tableCount: number, opts?: { tenantId?: string }): string {
    const lines: string[] = [
      '-- ============================================================',
      '-- TCP Database Backup',
      `-- Type: ${type}`,
      `-- Generated at: ${new Date().toISOString()}`,
      `-- Tables: ${tableCount}`,
    ]
    if (opts?.tenantId) {
      lines.push(`-- Tenant: ${opts.tenantId}`)
    }
    lines.push('-- ============================================================', '')
    return lines.join('\n')
  }

  /**
   * Generate a single SQL comment, handling multi-line content.
   */
  generateComment(text: string): string {
    return text
      .split('\n')
      .map((line) => `-- ${line}`)
      .join('\n')
  }

  /**
   * Generate CREATE TABLE IF NOT EXISTS statement from a TableSchema.
   */
  generateCreateTable(table: TableSchema): string {
    const lines: string[] = []
    lines.push(`CREATE TABLE IF NOT EXISTS "${table.name}" (`)

    const colDefs = table.columns.map((col) => {
      let def = `  "${col.name}" ${col.type}`
      if (!col.nullable) def += ' NOT NULL'
      if (col.defaultValue != null) def += ` DEFAULT ${col.defaultValue}`
      return def
    })

    if (table.primaryKey.length > 0) {
      const pkCols = table.primaryKey.map((pk) => `"${pk}"`).join(', ')
      colDefs.push(`  PRIMARY KEY (${pkCols})`)
    }

    lines.push(colDefs.join(',\n'))
    lines.push(');')
    return lines.join('\n')
  }

  /**
   * Generate CREATE INDEX statement.
   * Removes CONCURRENTLY since it's not valid inside a transaction or backup script.
   */
  generateCreateIndex(indexDef: string): string {
    const cleaned = indexDef.replace(/\bCONCURRENTLY\s+/, '')
    return `${cleaned};`
  }

  /**
   * Format a literal value for inclusion in an INSERT statement.
   * Handles type-aware formatting: strings, numbers, booleans, null,
   * JSON/BYTEA/UUID with type casts, arrays, timestamps, dates.
   */
  formatLiteral(value: unknown, pgType: string): string {
    if (value === null || value === undefined) return 'NULL'

    const typeBase = pgType.replace(/\[\]$/, '') // strip array suffix

    // Boolean
    if (typeBase === 'bool' || typeBase === 'boolean') {
      return value ? 'TRUE' : 'FALSE'
    }

    // Numeric types — no quotes needed for plain numbers
    if (['int2', 'int4', 'int8', 'smallint', 'integer', 'bigint', 'float4', 'float8', 'real', 'double precision'].includes(typeBase)) {
      return String(value)
    }

    // Numeric/Decimal — needs quotes to preserve precision
    if (['numeric', 'decimal', 'money'].includes(typeBase)) {
      return `${escapeLiteral(String(value))}::${typeBase}`
    }

    // BYTEA — hex format
    if (typeBase === 'bytea') {
      if (Buffer.isBuffer(value)) {
        return `'\\x${value.toString('hex')}'::bytea`
      }
      if (typeof value === 'string') {
        return `'\\x${Buffer.from(value).toString('hex')}'::bytea`
      }
      return `'\\x${String(value)}'::bytea`
    }

    // JSON types
    if (typeBase === 'json' || typeBase === 'jsonb') {
      const str = typeof value === 'string' ? value : JSON.stringify(value)
      return `${escapeLiteral(str)}::${typeBase}`
    }

    // UUID
    if (typeBase === 'uuid') {
      return `${escapeLiteral(String(value))}::uuid`
    }

    // Date/time types
    if (['date', 'time', 'timetz', 'timestamp', 'timestamptz', 'interval'].includes(typeBase)) {
      return `${escapeLiteral(String(value))}::${typeBase}`
    }

    // Arrays (types ending with _ prefix like _int4, _varchar)
    if (pgType.startsWith('_') || pgType.endsWith('[]')) {
      const elemType = pgType.startsWith('_') ? pgType.slice(1) : typeBase
      return `${escapeLiteral(String(value))}::${elemType}[]`
    }

    // Default: text/varchar/char — escape and quote
    return escapeLiteral(String(value))
  }

  /**
   * Generate an INSERT statement batch for multiple rows.
   */
  generateInsertBatch(tableName: string, columns: ColumnDef[], rows: unknown[][]): string {
    if (rows.length === 0) return ''

    const colNames = columns.map((c) => `"${c.name}"`).join(',')

    const valueLines = rows.map((row) => {
      const formatted = row.map((val, i) => this.formatLiteral(val, columns[i].type))
      return `(${formatted.join(',')})`
    })

    return [
      `INSERT INTO "${tableName}" (${colNames}) VALUES`,
      valueLines.join(',\n'),
      'ON CONFLICT DO NOTHING;',
    ].join('\n')
  }

  /**
   * Generate command to disable foreign key triggers during restore.
   */
  generateForeignKeyDisable(): string {
    return 'SET session_replication_role = replica;'
  }

  /**
   * Generate command to re-enable foreign key triggers after restore.
   */
  generateForeignKeyEnable(): string {
    return 'SET session_replication_role = default;'
  }
}

/**
 * Escape a string value for safe inclusion in single-quoted SQL literals.
 * Doubles single quotes, escapes backslash sequences.
 */
function escapeLiteral(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
  return `'${escaped}'`
}
