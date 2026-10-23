/**
 * @description Prune module — deletes old backup files and marks their logs as pruned.
 *
 * Retention-based cleanup: removes completed backups older than N days.
 * Called by the cron route post-backup, or as a standalone maintenance operation.
 */
import { prismaPlatform } from '@/lib/db/platform-prisma'
import { createStorage } from './storage'

export type BackupPruneScope =
  | { kind: 'tenant'; tenantId: string }
  | { kind: 'global'; type: 'full' | 'config' }

/**
 * @description Prunes completed backups older than the specified retention days.
 *
 * 1. Queries BackupLogs where status=completed AND createdAt < now - retentionDays
 * 2. Deletes each file from storage (best-effort per file)
 * 3. Marks each BackupLog status as 'pruned'
 *
 * @param retentionDays — number of days to retain (e.g. 30)
 * @param scope — mandatory ownership and backup-type boundary
 * @returns { pruned: number, failed: number }
 */
export async function pruneBackups(
  retentionDays: number,
  scope: BackupPruneScope,
): Promise<{
  pruned: number
  failed: number
}> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  const scopeWhere = scope.kind === 'tenant'
    ? { tenantId: scope.tenantId, type: 'tenant' as const }
    : { tenantId: null, type: scope.type }

  const oldBackups = await prismaPlatform.backupLog.findMany({
    where: {
      ...scopeWhere,
      status: 'completed',
      createdAt: { lt: cutoff },
    },
    select: {
      backupLogId: true,
      fileName: true,
    },
  })

  if (oldBackups.length === 0) {
    return { pruned: 0, failed: 0 }
  }

  const storage = createStorage()
  let pruned = 0
  let failed = 0

  for (const backup of oldBackups) {
    // Mark only the still-completed record inside the same prune scope.
    try {
      const result = await prismaPlatform.backupLog.updateMany({
        where: {
          backupLogId: backup.backupLogId,
          ...scopeWhere,
          status: 'completed',
        },
        data: { status: 'pruned' },
      })
      if (result.count !== 1) {
        failed++
        continue
      }
    } catch (err) {
      console.error(
        `[pruneBackups] Failed to update log ${backup.backupLogId}:`,
        err,
      )
      failed++
      continue
    }

    // Delete the file only after the scoped status mutation succeeds.
    if (backup.fileName) {
      try {
        await storage.delete(backup.fileName)
      } catch (err) {
        console.error(
          `[pruneBackups] Failed to delete file ${backup.fileName}:`,
          err,
        )
        failed++
        continue
      }
    }
    pruned++
  }

  return { pruned, failed }
}
