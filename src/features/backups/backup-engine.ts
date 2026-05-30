/**
 * @description BackupEngine — orchestrator that runs the full backup workflow.
 *
 * Flow: SchemaReader → DataExporter → SQLBuilder → gzip → Storage
 *
 * Memory-safe: processes one table at a time, one batch at a time.
 * Each batch is immediately written to the output buffer.
 */
import { gzipSync } from 'zlib'
import { PrismaClient } from '@/generated/prisma'
import type { BackupStorage } from './storage/types'
import { SchemaReader } from './schema-reader'
import { DataExporter } from './data-exporter'
import { SQLBuilder } from './sql-builder'
import type { BackupOptions, BackupResult } from './types'
import type { ColumnDef } from './types'

const DEFAULT_PRISMA = new PrismaClient()

export interface BackupEngineOptions {
  prisma?: PrismaClient
  storage: BackupStorage
  pool?: import('pg').Pool
  schemaReader?: SchemaReader
  dataExporter?: DataExporter
  sqlBuilder?: SQLBuilder
}

/**
 * BackupEngine — coordinates the full backup lifecycle.
 */
export class BackupEngine {
  private prisma: PrismaClient
  private storage: BackupStorage
  private schemaReader: SchemaReader
  private dataExporter: DataExporter
  private sqlBuilder: SQLBuilder

  constructor(opts: BackupEngineOptions) {
    this.prisma = opts.prisma ?? DEFAULT_PRISMA
    this.storage = opts.storage
    this.schemaReader = opts.schemaReader ?? new SchemaReader(opts.pool)
    this.dataExporter = opts.dataExporter ?? new DataExporter(
      opts.pool ?? new (require('pg').Pool)({ connectionString: process.env.DATABASE_URL }),
    )
    this.sqlBuilder = opts.sqlBuilder ?? new SQLBuilder()
  }

  /**
   * Execute the full backup workflow.
   *
   * @param options — backup type, optional tenantId
   * @param signal — optional AbortSignal for cancellation
   * @param userId — ID of the user triggering the backup (for BackupLog)
   * @returns BackupResult with log ID and file info
   */
  async run(
    options: BackupOptions,
    backupLogId: string,
    signal: AbortSignal | undefined,
    userId: string,
  ): Promise<BackupResult> {
    const startedAt = new Date()

    // BackupLog already created by the action layer — update its startedAt
    const log = { backupLogId }

    let fileUrl: string | undefined
    let fileSize = 0

    try {
      // 1. Discover schema
      if (signal?.aborted) throw Object.assign(new Error('Backup cancelled'), { code: 'ABORT_ERR' })
      const schema = await this.schemaReader.discover()

      // Filter tables based on backup type
      const tablesToExport = this.filterTables(schema.tables, options)

      // 2. Generate SQL content
      const sqlParts: string[] = []

      // Header
      sqlParts.push(this.sqlBuilder.generateTopComment(
        options.type,
        tablesToExport.length,
        options.tenantId ? { tenantId: options.tenantId } : undefined,
      ))

      // Disable FKs
      sqlParts.push(this.sqlBuilder.generateForeignKeyDisable())

      // 3. For each table in topological order:
      for (const table of tablesToExport) {
        if (signal?.aborted) throw Object.assign(new Error('Backup cancelled'), { code: 'ABORT_ERR' })

        sqlParts.push('')
        sqlParts.push(this.sqlBuilder.generateComment(`Table: ${table.name}`))

        // CREATE TABLE
        sqlParts.push(this.sqlBuilder.generateCreateTable(table))
        sqlParts.push('')

        // Indexes
        for (const idx of table.indexes) {
          sqlParts.push(this.sqlBuilder.generateCreateIndex(idx))
        }
        if (table.indexes.length > 0) sqlParts.push('')

        // Data export — stream batches
        const tenantFilter = options.type === 'tenant' && options.tenantId
          ? { tenantId: options.tenantId }
          : undefined

        for await (const batch of this.dataExporter.exportTable(
          table.name,
          table.columns,
          table.primaryKey,
          signal,
          tenantFilter,
        )) {
      if (signal?.aborted) throw Object.assign(new Error('Backup cancelled'), { code: 'ABORT_ERR' })

          // Skip config-only tables that don't match
          if (options.type === 'config' && !CONFIG_TABLES.has(table.name)) continue

          const insertSql = this.sqlBuilder.generateInsertBatch(
            table.name,
            table.columns,
            batch,
          )
          if (insertSql) sqlParts.push(insertSql)
        }
      }

      // Re-enable FKs
      sqlParts.push('')
      sqlParts.push(this.sqlBuilder.generateForeignKeyEnable())
      sqlParts.push(this.sqlBuilder.generateComment('Backup complete'))

      // 4. Compress with gzip
      if (signal?.aborted) throw Object.assign(new Error('Backup cancelled'), { code: 'ABORT_ERR' })
      const sqlContent = sqlParts.join('\n')
      const compressed = gzipSync(Buffer.from(sqlContent, 'utf-8'))
      fileSize = compressed.length

      // 5. Save to storage
      const fileName = this.buildFileName(options, startedAt)
      fileUrl = await this.storage.save(fileName, compressed)

      // 6. Update BackupLog as completed
      const completedAt = new Date()
      const durationMs = completedAt.getTime() - startedAt.getTime()
      await this.prisma.backupLog.update({
        where: { backupLogId: log.backupLogId },
        data: {
          status: 'completed',
          fileUrl,
          fileName,
          fileSize,
          completedAt,
        },
      })

      return {
        backupLogId: log.backupLogId,
        fileUrl,
        fileSize,
        durationMs,
      }
    } catch (err) {
      // Mark as failed, clean up partial file
      await this.prisma.backupLog.update({
        where: { backupLogId: log.backupLogId },
        data: {
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        },
      }).catch(() => {
        // Best-effort: log update failure is non-fatal at this point
      })

      // Clean up partial file if any
      if (fileUrl) {
        try {
          const fileName = this.storage.getFileName(fileUrl)
          await this.storage.delete(fileName)
        } catch {
          // Best-effort cleanup
        }
      }

      throw err
    }
  }

  /**
   * Filter tables based on backup type and tenant scope.
   */
  private filterTables(
    tables: Array<{
      name: string
      columns: ColumnDef[]
      primaryKey: string[]
      indexes: string[]
      foreignKeys: Array<{ tableName: string; refTable: string; refColumn: string }>
    }>,
    options: BackupOptions,
  ): typeof tables {
    if (options.type === 'config') {
      return tables.filter((t) => CONFIG_TABLES.has(t.name))
    }
    // Full and tenant backups include all tables
    return tables
  }

  /**
   * Build a filename for the backup file.
   */
  private buildFileName(options: BackupOptions, date: Date): string {
    const ts = date.toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const type = options.type
    const tenant = options.tenantId ? `_${options.tenantId}` : ''
    return `backups/${type}${tenant}_${ts}.sql.gz`
  }
}

/**
 * Tables included in config-only backups.
 */
const CONFIG_TABLES = new Set([
  'Tenant',
  'TenantMembership',
  'TenantLicense',
  'User',
  'Plan',
  'Licencia',
  'LicenciaAudit',
  'MiEmpresa',
])
