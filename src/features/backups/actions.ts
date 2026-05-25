/**
 * @description Server Actions for backup operations.
 *
 * All actions require admin role (`user.role === 'admin'`).
 * Backup execution runs asynchronously — the action returns immediately
 * with the backupLogId, and the client polls via getBackupStatusAction.
 *
 * @module features/backups/actions
 */
'use server'

import { revalidatePath } from 'next/cache'
import { withAction, ActionError } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import { BackupEngine } from './backup-engine'
import { RestoreEngine } from './restore-engine'
import { createStorage } from './storage'
import {
  createBackupSchema,
  deleteBackupSchema,
  restoreBackupSchema,
  getBackupsSchema,
} from './schemas'
import type {
  CreateBackupInput,
  RestoreBackupInput,
  GetBackupsInput,
} from './schemas'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

// ─── Backup Execution ───────────────────────────────────────

/**
 * @description Triggers a backup execution (full, tenant, or config).
 * Returns immediately with the backupLogId. The backup runs in the background.
 * The client can poll getBackupStatusAction for progress.
 *
 * Auth: admin only
 */
export const createBackupAction = withAction(
  async (input: CreateBackupInput, user: AuthenticatedUser) => {
    if (user.role !== 'admin') {
      throw new ActionError('Acceso restringido', 'FORBIDDEN')
    }

    const parsed = createBackupSchema.parse(input)

    // For per-tenant backup, verify tenant exists
    if (parsed.type === 'tenant' && parsed.tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { tenantId: parsed.tenantId },
        select: { tenantId: true },
      })
      if (!tenant) {
        throw new ActionError('Tenant no encontrado', 'NOT_FOUND')
      }
    }

    // Instantiate engine and start backup in background
    const engine = new BackupEngine({
      storage: createStorage(),
    })

    // Fire-and-forget: the backup runs asynchronously.
    // For production on Railway/Vercel, replace with a queue or waitUntil.
    void engine
      .run(
        { type: parsed.type, tenantId: parsed.tenantId },
        undefined,
        user.userId,
      )
      .then(() => revalidatePath('/admin/backups'))
      .catch((err) => {
        console.error('[createBackupAction] Backup failed:', err)
      })

    // Return the BackupLog — the engine creates it synchronously at start.
    // We query the most recent running log for this user.
    const log = await prisma.backupLog.findFirst({
      where: { createdBy: user.userId, status: 'running' },
      orderBy: { createdAt: 'desc' },
      select: { backupLogId: true },
    })

    if (!log) {
      throw new ActionError('Error al iniciar la copia de seguridad', 'INTERNAL_ERROR')
    }

    revalidatePath('/admin/backups')
    return { backupLogId: log.backupLogId }
  },
)

// ─── Backup Listing ─────────────────────────────────────────

/**
 * @description Returns a paginated list of backup logs with optional filters.
 *
 * Auth: admin only
 */
export const getBackupsAction = withAction(
  async (input: GetBackupsInput, user: AuthenticatedUser) => {
    if (user.role !== 'admin') {
      throw new ActionError('Acceso restringido', 'FORBIDDEN')
    }

    const parsed = getBackupsSchema.parse(input)

    const where: Record<string, unknown> = {}
    if (parsed.type) where.type = parsed.type
    if (parsed.tenantId) where.tenantId = parsed.tenantId
    if (parsed.status) where.status = parsed.status

    const [logs, total] = await Promise.all([
      prisma.backupLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parsed.limit,
        skip: parsed.offset,
        select: {
          backupLogId: true,
          type: true,
          tenantId: true,
          status: true,
          fileUrl: true,
          fileName: true,
          fileSize: true,
          startedAt: true,
          completedAt: true,
          errorMessage: true,
          createdBy: true,
          createdAt: true,
        },
      }),
      prisma.backupLog.count({ where }),
    ])

    return { logs, total, limit: parsed.limit, offset: parsed.offset }
  },
)

// ─── Single Backup ─────────────────────────────────────────

/**
 * @description Returns a single backup log by ID.
 *
 * Auth: admin only
 */
export const getBackupAction = withAction(
  async (input: { backupLogId: string }, user: AuthenticatedUser) => {
    if (user.role !== 'admin') {
      throw new ActionError('Acceso restringido', 'FORBIDDEN')
    }

    const log = await prisma.backupLog.findUnique({
      where: { backupLogId: input.backupLogId },
      select: {
        backupLogId: true,
        type: true,
        tenantId: true,
        status: true,
        fileUrl: true,
        fileName: true,
        fileSize: true,
        startedAt: true,
        completedAt: true,
        errorMessage: true,
        createdBy: true,
        createdAt: true,
      },
    })

    if (!log) {
      throw new ActionError('Copia de seguridad no encontrada', 'NOT_FOUND')
    }

    return log
  },
)

// ─── Backup Status Polling ──────────────────────────────────

/**
 * @description Returns the current status of a backup (for polling).
 * Lightweight: returns only status + errorMessage.
 *
 * Auth: admin only
 */
export const getBackupStatusAction = withAction(
  async (input: { backupLogId: string }, user: AuthenticatedUser) => {
    if (user.role !== 'admin') {
      throw new ActionError('Acceso restringido', 'FORBIDDEN')
    }

    const log = await prisma.backupLog.findUnique({
      where: { backupLogId: input.backupLogId },
      select: {
        status: true,
        errorMessage: true,
        fileUrl: true,
        fileSize: true,
        completedAt: true,
      },
    })

    if (!log) {
      throw new ActionError('Copia de seguridad no encontrada', 'NOT_FOUND')
    }

    return log
  },
)

// ─── Backup Deletion ────────────────────────────────────────

/**
 * @description Deletes a backup file from storage and marks the BackupLog as deleted.
 *
 * Auth: admin only
 */
export const deleteBackupAction = withAction(
  async (input: { backupLogId: string }, user: AuthenticatedUser) => {
    if (user.role !== 'admin') {
      throw new ActionError('Acceso restringido', 'FORBIDDEN')
    }

    const parsed = deleteBackupSchema.parse(input)

    const log = await prisma.backupLog.findUnique({
      where: { backupLogId: parsed.backupLogId },
      select: { backupLogId: true, fileUrl: true, fileName: true },
    })

    if (!log) {
      throw new ActionError('Copia de seguridad no encontrada', 'NOT_FOUND')
    }

    // Delete file from storage
    if (log.fileName) {
      try {
        const storage = createStorage()
        await storage.delete(log.fileName)
      } catch (err) {
        console.error('[deleteBackupAction] Storage delete failed:', err)
        // Non-fatal: proceed to mark as deleted even if storage fails
      }
    }

    // Mark BackupLog as deleted
    await prisma.backupLog.update({
      where: { backupLogId: parsed.backupLogId },
      data: { status: 'deleted' },
    })

    revalidatePath('/admin/backups')
    return { success: true }
  },
)

// ─── Download URL ───────────────────────────────────────────

/**
 * @description Returns a download URL for a backup file (1h expiry for signed URLs).
 *
 * Auth: admin only
 */
export const downloadBackupAction = withAction(
  async (input: { backupLogId: string }, user: AuthenticatedUser) => {
    if (user.role !== 'admin') {
      throw new ActionError('Acceso restringido', 'FORBIDDEN')
    }

    const log = await prisma.backupLog.findUnique({
      where: { backupLogId: input.backupLogId },
      select: { fileUrl: true, fileName: true, status: true },
    })

    if (!log) {
      throw new ActionError('Copia de seguridad no encontrada', 'NOT_FOUND')
    }

    if (log.status !== 'completed') {
      throw new ActionError(
        'La copia de seguridad no está disponible para descarga',
        'INVALID_STATE',
      )
    }

    if (!log.fileName) {
      throw new ActionError(
        'Archivo de copia de seguridad no disponible',
        'FILE_NOT_FOUND',
      )
    }

    const storage = createStorage()
    const downloadUrl = await storage.getDownloadUrl(log.fileName)

    return { downloadUrl, fileName: log.fileName }
  },
)

// ─── Restore ────────────────────────────────────────────────

/**
 * @description Restores a backup. Requires confirmation string to prevent accidents.
 * The actual restore engine is implemented in Phase 7.
 *
 * Auth: admin only
 */
export const restoreBackupAction = withAction(
  async (input: RestoreBackupInput, user: AuthenticatedUser) => {
    if (user.role !== 'admin') {
      throw new ActionError('Acceso restringido', 'FORBIDDEN')
    }

    const parsed = restoreBackupSchema.parse(input)

    const log = await prisma.backupLog.findUnique({
      where: { backupLogId: parsed.backupLogId },
      select: {
        type: true,
        status: true,
        fileName: true,
        fileUrl: true,
      },
    })

    if (!log) {
      throw new ActionError('Copia de seguridad no encontrada', 'NOT_FOUND')
    }

    if (log.status !== 'completed') {
      throw new ActionError(
        'Solo se pueden restaurar copias completadas',
        'INVALID_STATE',
      )
    }

    // Verify confirmation string
    const expectedConfirmation =
      log.type === 'full' ? 'FULL RESTORE' : 'RESTORE'

    if (parsed.confirmation !== expectedConfirmation) {
      throw new ActionError(
        `Confirmación inválida. Escribí "${expectedConfirmation}" para confirmar.`,
        'INVALID_CONFIRMATION',
      )
    }

    // Execute restore (synchronous — no fire-and-forget)
    const engine = new RestoreEngine({ storage: createStorage() })
    const result = await engine.restore(
      parsed.backupLogId,
      log.fileName!,
      user.userId,
    )

    revalidatePath('/admin/backups')
    return {
      success: true,
      backupLogId: result.backupLogId,
      restoredTables: result.restoredTables,
      restoredRows: result.restoredRows,
    }
  },
)
