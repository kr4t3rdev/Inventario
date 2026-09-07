/**
 * @description BackupEngine — orchestrator that runs the full backup workflow.
 *
 * Flow: SchemaReader → DataExporter → SQLBuilder → gzip → Storage
 *
 * Memory-safe: processes one table at a time, one batch at a time.
 * Each batch is immediately written to the output buffer.
 */
import { gzipSync, gunzipSync } from 'zlib'
import { PrismaClient } from '@/generated/prisma'
import { prismaPlatform } from '@/lib/db/platform-prisma'
import type { BackupStorage } from './storage/types'
import { SchemaReader } from './schema-reader'
import { DataExporter } from './data-exporter'
import { SQLBuilder } from './sql-builder'
import type { BackupOptions, BackupResult } from './types'
import type { ColumnDef } from './types'
import type { TenantTableFilter } from './data-exporter'

/**
 * @description Validates a buffer as a valid .sql.gz backup file.
 * Checks gzip magic bytes (0x1f 0x8b), decompresses, and verifies SQL-like content.
 *
 * @param buffer - Raw file buffer
 * @returns Object with valid flag and optional error message
 */
export function validateBackupFile(buffer: Buffer): {
	valid: boolean
	error?: string
} {
	if (buffer.length < 2 || buffer[0] !== 0x1f || buffer[1] !== 0x8b) {
		return {
			valid: false,
			error: 'El archivo no es un backup v\u00e1lido (.sql.gz)',
		}
	}

	try {
		const decompressed = gunzipSync(buffer)
		const content = decompressed.toString('utf-8').trim()

		if (!content || content.length === 0) {
			return { valid: false, error: 'El archivo est\u00e1 vac\u00edo' }
		}

		const hasSQLHeader = /^(--|<|CREATE|INSERT|SET|BEGIN)/i.test(content)
		if (!hasSQLHeader) {
			return {
				valid: false,
				error: 'El archivo no contiene un backup SQL v\u00e1lido',
			}
		}

		return { valid: true }
	} catch {
		return {
			valid: false,
			error: 'El archivo no se puede descomprimir como gzip',
		}
	}
}

const DEFAULT_PRISMA = prismaPlatform
const TENANT_GLOBAL_TABLE_FILTERS: Record<string, TenantTableFilter['mode']> = {
  tenants: 'tenant-row',
  User: 'user-membership',
  Plan: 'plan-by-tenant',
}

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
      const tenantScopedTables = new Set(schema.tenantScopedTables)

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
        const tenantFilter = this.resolveTenantFilter(
          table.name,
          tenantScopedTables,
          options,
        )

        if (options.type === 'tenant' && options.tenantId && tenantFilter === null) {
          continue
        }

        for await (const batch of this.dataExporter.exportTable(
          table.name,
          table.columns,
          table.primaryKey,
          signal,
          tenantFilter ?? undefined,
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
    return `${type}${tenant}_${ts}.sql.gz`
  }

  private resolveTenantFilter(
    tableName: string,
    tenantScopedTables: Set<string>,
    options: BackupOptions,
  ): TenantTableFilter | null | undefined {
    if (options.type !== 'tenant' || !options.tenantId) {
      return undefined
    }

    if (tenantScopedTables.has(tableName)) {
      return {
        tenantId: options.tenantId,
        mode: 'tenant-column',
      }
    }

    const globalMode = TENANT_GLOBAL_TABLE_FILTERS[tableName]
    if (!globalMode) {
      return null
    }

    return {
      tenantId: options.tenantId,
      mode: globalMode,
    }
  }
}

/**
 * Tables included in config-only backups.
 */
const CONFIG_TABLES = new Set([
  'tenants',
  'tenant_memberships',
  'tenant_licenses',
  'User',
  'Plan',
  'MiEmpresa',
])
