/**
 * @description Prune module — deletes old backup files and marks their logs as pruned.
 *
 * Retention-based cleanup: removes completed backups older than N days.
 * Called by the cron route post-backup, or as a standalone maintenance operation.
 */
import { prisma } from '@/lib/prisma'
import { createStorage } from './storage'

/**
 * @description Prunes completed backups older than the specified retention days.
 *
 * 1. Queries BackupLogs where status=completed AND createdAt < now - retentionDays
 * 2. Deletes each file from storage (best-effort per file)
 * 3. Marks each BackupLog status as 'pruned'
 *
 * @param retentionDays — number of days to retain (e.g. 30)
 * @returns { pruned: number, failed: number }
 */
export async function pruneBackups(retentionDays: number): Promise<{
  pruned: number
  failed: number
}> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  const oldBackups = await prisma.backupLog.findMany({
    where: {
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
    // Delete file from storage (best-effort)
    if (backup.fileName) {
      try {
        await storage.delete(backup.fileName)
      } catch (err) {
        console.error(
          `[pruneBackups] Failed to delete file ${backup.fileName}:`,
          err,
        )
        // Non-fatal: proceed to mark as pruned even if file delete fails
      }
    }

    // Mark as pruned
    try {
      await prisma.backupLog.update({
        where: { backupLogId: backup.backupLogId },
        data: { status: 'pruned' },
      })
      pruned++
    } catch (err) {
      console.error(
        `[pruneBackups] Failed to update log ${backup.backupLogId}:`,
        err,
      )
      failed++
    }
  }

  return { pruned, failed }
}
