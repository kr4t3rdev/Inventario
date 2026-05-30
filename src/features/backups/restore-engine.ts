/**
 * @description RestoreEngine — decompress and execute a SQL backup dump.
 *
 * Supports three restore modes:
 * - full:   BEGIN → TRUNCATE reverse FK order → INSERT in FK order → COMMIT
 * - tenant: BEGIN → DELETE tenant rows → INSERT tenant rows → COMMIT
 * - config: BEGIN → CREATE TABLE IF NOT EXISTS → INSERT ON CONFLICT → COMMIT
 *
 * All modes run inside a single PostgreSQL transaction.
 * On any error: ROLLBACK + mark BackupLog as failed.
 *
 * @module features/backups/restore-engine
 */
import { gunzipSync } from 'zlib'
import { Pool } from 'pg'
import { PrismaClient } from '@/generated/prisma'
import type { BackupStorage } from './storage/types'

const DEFAULT_PRISMA = new PrismaClient()

export interface RestoreResult {
  backupLogId: string
  restoredTables: number
  restoredRows: number
  durationMs: number
}

export type SqlStatementType =
  | 'create_table'
  | 'insert'
  | 'create_index'
  | 'fk_disable'
  | 'fk_enable'
  | 'comment'
  | 'set_config'
  | 'unknown'

export interface SqlStatement {
  type: SqlStatementType
  sql: string
  tableName?: string
  /** Approximate number of rows in this INSERT batch */
  rowCount: number
}

export interface RestoreEngineOptions {
  prisma?: PrismaClient
  storage: BackupStorage
  pool?: Pool
}

/**
 * RestoreEngine — executes a SQL backup dump against the database.
 */
export class RestoreEngine {
  private prisma: PrismaClient
  private storage: BackupStorage
  private pool: Pool

  constructor(opts: RestoreEngineOptions) {
    this.prisma = opts.prisma ?? DEFAULT_PRISMA
    this.storage = opts.storage
    this.pool =
      opts.pool ??
      new Pool({ connectionString: process.env.DATABASE_URL })
  }

  // ─── Public API ───────────────────────────────────────────

  /**
   * Restore a backup file.
   *
   * @param backupLogId — ID of the backup log to restore
   * @param fileName — storage filename of the .sql.gz dump
   * @param userId — user triggering the restore
   * @returns RestoreResult
   */
  async restore(
    backupLogId: string,
    fileName: string,
    userId: string,
  ): Promise<RestoreResult> {
    const startedAt = Date.now()

    // 1. Fetch the backup log info
    const log = await this.prisma.backupLog.findUniqueOrThrow({
      where: { backupLogId },
      select: { type: true, tenantId: true },
    })

    // 2. Download & decompress
    const stream = await this.storage.get(fileName)
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const compressed = Buffer.concat(chunks)
    const sqlContent = gunzipSync(compressed).toString('utf-8')

    // 3. Parse and classify statements
    const statements = this.parseSql(sqlContent)
    const { inserts, createTables, indexes, fkDisable, fkEnable, setConfigs } =
      this.classifyStatements(statements)

    // 4. Extract table order from CREATE TABLE statements
    const tableOrder = createTables.map((s) => s.tableName!).filter(Boolean)

    // 5. Count total rows from INSERT statements
    const totalRows = inserts.reduce((sum, s) => sum + s.rowCount, 0)

    // 6. Register a restore log entry
    const restoreLog = await this.prisma.backupLog.create({
      data: {
        type: log.type,
        tenantId: log.tenantId,
        status: 'running',
        startedAt: new Date(startedAt),
        createdBy: userId,
      },
    })

    try {
      // 7. Execute restore based on type
      const client = await this.pool.connect()

      try {
        await client.query('BEGIN')

        if (log.type === 'full' || log.type === 'imported') {
          await this.executeFullRestore(client, tableOrder, inserts)
        } else if (log.type === 'tenant') {
          await this.executeTenantRestore(client, log.tenantId!, tableOrder, statements)
        } else {
          // config — UPSERT only
          await this.executeConfigRestore(client, statements)
        }

        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }

      // 8. Mark restore log as completed
      const completedAt = new Date()
      const durationMs = completedAt.getTime() - startedAt
      await this.prisma.backupLog.update({
        where: { backupLogId: restoreLog.backupLogId },
        data: {
          status: 'completed',
          completedAt,
        },
      })

      return {
        backupLogId: restoreLog.backupLogId,
        restoredTables: tableOrder.length,
        restoredRows: totalRows,
        durationMs,
      }
    } catch (err) {
      // Mark restore as failed
      await this.prisma.backupLog
        .update({
          where: { backupLogId: restoreLog.backupLogId },
          data: {
            status: 'failed',
            errorMessage: err instanceof Error ? err.message : String(err),
            completedAt: new Date(),
          },
        })
        .catch(() => {})

      throw err
    }
  }

  // ─── Restore Strategies ───────────────────────────────────

  /**
   * Full restore:
   * 1. Disable triggers
   * 2. TRUNCATE CASCADE in reverse FK order
   * 3. Execute INSERT statements in FK order
   * 4. Re-enable triggers
   *
   * Tables already exist (we truncate, not drop). No need to re-run CREATE TABLE.
   */
  private async executeFullRestore(
    client: import('pg').PoolClient,
    tableOrder: string[],
    inserts: SqlStatement[],
  ): Promise<void> {
    // Disable triggers for bulk load performance
    await client.query('SET session_replication_role = replica')

    // TRUNCATE in reverse FK order to respect dependencies
    const reverseOrder = [...tableOrder].reverse()
    for (const table of reverseOrder) {
      await client.query(`TRUNCATE TABLE "${table}" CASCADE`)
    }

    // Execute INSERT statements in FK order (already sorted by the dump)
    for (const stmt of inserts) {
      await client.query(stmt.sql)
    }

    // Re-enable triggers
    await client.query('SET session_replication_role = DEFAULT')
  }

  /**
   * Tenant restore:
   * 1. Disable triggers
   * 2. DELETE existing tenant data from tenant-scoped tables (reverse FK order)
   * 3. INSERT backed-up data (original FK order)
   * 4. Re-enable triggers
   */
  private async executeTenantRestore(
    client: import('pg').PoolClient,
    tenantId: string,
    tableOrder: string[],
    statements: SqlStatement[],
  ): Promise<void> {
    await client.query('SET session_replication_role = replica')

    // DELETE existing tenant data (reverse FK order, only tables with tenantId)
    const reverseOrder = [...tableOrder].reverse()
    for (const table of reverseOrder) {
      const hasTenantId = await this.tableHasTenantColumn(client, table)
      if (hasTenantId) {
        await client.query(`DELETE FROM "${table}" WHERE "tenantId" = $1`, [tenantId])
      }
    }

    // Execute INSERTs in FK order
    for (const stmt of statements) {
      if (stmt.type === 'insert') {
        await client.query(stmt.sql)
      }
    }

    await client.query('SET session_replication_role = DEFAULT')
  }

  /**
   * Config restore (UPSERT):
   * 1. Disable triggers
   * 2. CREATE TABLE IF NOT EXISTS for each table
   * 3. INSERT ON CONFLICT DO NOTHING
   * 4. Re-enable triggers
   */
  private async executeConfigRestore(
    client: import('pg').PoolClient,
    statements: SqlStatement[],
  ): Promise<void> {
    await client.query('SET session_replication_role = replica')

    for (const stmt of statements) {
      if (stmt.type === 'create_table') {
        // CREATE TABLE IF NOT EXISTS (safe for existing tables)
        const ifNotExists = stmt.sql.replace(
          /CREATE\s+TABLE\s+/i,
          'CREATE TABLE IF NOT EXISTS ',
        )
        await client.query(ifNotExists)
      } else if (stmt.type === 'insert') {
        // Rewrite INSERT to use ON CONFLICT DO NOTHING
        const upsertSql = this.rewriteInsertOnConflict(stmt.sql)
        await client.query(upsertSql)
      }
    }

    await client.query('SET session_replication_role = DEFAULT')
  }

  // ─── SQL Parsing ──────────────────────────────────────────

  /**
   * Split a SQL dump into individual statements.
   * Respects string literals so semicolons inside values don't split.
   */
  parseSql(sql: string): SqlStatement[] {
    const statements: SqlStatement[] = []
    const lines = sql.split('\n')
    let current = ''
    let inString = false
    let stringChar: string | null = null

    for (let line of lines) {
      const trimmed = line.trim()
      // Skip pure comment lines
      if (trimmed.startsWith('--') && !inString) {
        statements.push({ type: 'comment', sql: line, rowCount: 0 })
        continue
      }

      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        const prev = i > 0 ? line[i - 1] : ''

        if (inString) {
          if (ch === stringChar && prev !== '\\') {
            inString = false
            stringChar = null
          }
        } else {
          if (ch === "'" || ch === '"') {
            inString = true
            stringChar = ch
          } else if (ch === ';') {
            current += line.slice(0, i + 1)
            const trimmedStmt = current.trim()
            if (trimmedStmt) {
              statements.push(this.classifyStatement(trimmedStmt))
            }
            current = ''
            line = line.slice(i + 1)
            i = -1
            continue
          }
        }
      }

      current += line + '\n'
    }

    // Flush remaining
    const remaining = current.trim()
    if (remaining) {
      statements.push(this.classifyStatement(remaining))
    }

    return statements
  }

  /**
   * Classify a single SQL statement by type.
   */
  private classifyStatement(sql: string): SqlStatement {
    const trimmed = sql.trim()
    const upper = trimmed.toUpperCase()

    if (upper.startsWith('--') || upper.startsWith('/*')) {
      return { type: 'comment', sql: trimmed, rowCount: 0 }
    }

    if (upper.startsWith('SET ')) {
      return { type: 'set_config', sql: trimmed, rowCount: 0 }
    }

    if (upper.includes('DISABLE TRIGGER') || upper.includes('DISABLE TRIGGERS')) {
      return { type: 'fk_disable', sql: trimmed, rowCount: 0 }
    }

    if (upper.includes('ENABLE TRIGGER') || upper.includes('ENABLE TRIGGERS')) {
      return { type: 'fk_enable', sql: trimmed, rowCount: 0 }
    }

    if (upper.startsWith('CREATE TABLE')) {
      const tableName = this.extractTableName(trimmed, 'CREATE TABLE')
      return { type: 'create_table', sql: trimmed, tableName, rowCount: 0 }
    }

    if (upper.startsWith('CREATE INDEX') || upper.startsWith('CREATE UNIQUE INDEX')) {
      const tableName = this.extractIndexTable(trimmed)
      return { type: 'create_index', sql: trimmed, tableName, rowCount: 0 }
    }

    if (upper.startsWith('INSERT INTO')) {
      const tableName = this.extractTableName(trimmed, 'INSERT INTO')
      const rowCount = this.countInsertRows(trimmed)
      return { type: 'insert', sql: trimmed, tableName, rowCount }
    }

    return { type: 'unknown', sql: trimmed, rowCount: 0 }
  }

  /**
   * Group statements by type for easier processing.
   */
  private classifyStatements(statements: SqlStatement[]) {
    const inserts: SqlStatement[] = []
    const createTables: SqlStatement[] = []
    const indexes: SqlStatement[] = []
    const fkDisable: SqlStatement[] = []
    const fkEnable: SqlStatement[] = []
    const setConfigs: SqlStatement[] = []
    const others: SqlStatement[] = []

    for (const stmt of statements) {
      switch (stmt.type) {
        case 'insert':
          inserts.push(stmt)
          break
        case 'create_table':
          createTables.push(stmt)
          break
        case 'create_index':
          indexes.push(stmt)
          break
        case 'fk_disable':
          fkDisable.push(stmt)
          break
        case 'fk_enable':
          fkEnable.push(stmt)
          break
        case 'set_config':
          setConfigs.push(stmt)
          break
        default:
          others.push(stmt)
      }
    }

    return { inserts, createTables, indexes, fkDisable, fkEnable, setConfigs, others }
  }

  // ─── SQL Helpers ──────────────────────────────────────────

  /**
   * Extract table name from a SQL statement.
   */
  private extractTableName(sql: string, prefix: string): string | undefined {
    const remaining = sql.trim().slice(prefix.length).trim()
    const match = remaining.match(/^"?(\w+)"?(?:\s|$|\.|\,|\()/)
    return match?.[1] ?? undefined
  }

  /**
   * Extract table name from a CREATE INDEX statement.
   */
  private extractIndexTable(sql: string): string | undefined {
    const match = sql.match(/ON\s+"?(\w+)"?\s*\(/i)
    return match?.[1] ?? undefined
  }

  /**
   * Rewrite INSERT INTO ... VALUES to use ON CONFLICT DO NOTHING.
   */
  private rewriteInsertOnConflict(sql: string): string {
    const trimmed = sql.trim().replace(/;+$/, '')
    return `${trimmed} ON CONFLICT DO NOTHING`
  }

  /**
   * Count approximate rows in an INSERT statement.
   * INSERT INTO t (cols) VALUES (row1), (row2), ...
   * Count the value tuples.
   */
  private countInsertRows(sql: string): number {
    const valuesMatch = sql.match(/VALUES\s*([\s\S]*)/i)
    if (!valuesMatch) return 0

    let valuesPart = valuesMatch[1].trim()
    // Strip trailing semicolon
    if (valuesPart.endsWith(';')) valuesPart = valuesPart.slice(0, -1)

    // Split by ),( at the top level (not inside strings)
    // Simple heuristic: count number of parenthesized groups at top level
    let depth = 0
    let groups = 0
    for (const ch of valuesPart) {
      if (ch === '(') {
        depth++
        if (depth === 1) groups++
      } else if (ch === ')') {
        depth--
      }
    }

    return groups
  }

  /**
   * Check if a table has a tenantId column.
   */
  private async tableHasTenantColumn(
    client: import('pg').PoolClient,
    tableName: string,
  ): Promise<boolean> {
    const result = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = $1 AND column_name = 'tenantId'
      ) AS exists`,
      [tableName],
    )
    return result.rows[0]?.exists ?? false
  }
}
