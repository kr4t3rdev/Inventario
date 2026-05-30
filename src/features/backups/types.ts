/**
 * @description Shared types for the backup feature.
 */
import type { BackupType, BackupStatus } from '@/generated/prisma'

export interface BackupOptions {
  type: BackupType
  tenantId?: string
}

export interface BackupResult {
  backupLogId: string
  fileUrl: string
  fileSize: number
  durationMs: number
}

export interface ColumnDef {
  name: string
  type: string
  nullable: boolean
  defaultValue: string | null
  isPrimaryKey: boolean
}

export interface FKDef {
  /** Table that owns the foreign key */
  tableName: string
  /** Referenced table */
  refTable: string
  /** Referenced column */
  refColumn: string
}

export interface TableSchema {
  name: string
  columns: ColumnDef[]
  primaryKey: string[]
  indexes: string[]
  foreignKeys: FKDef[]
}

export interface BackupLogRow {
  backupLogId: string
  type: BackupType
  tenantId: string | null
  status: BackupStatus
  fileUrl: string | null
  fileName: string | null
  fileSize: number | null
  startedAt: Date
  completedAt: Date | null
  errorMessage: string | null
  createdBy: string
  createdAt: Date
}
