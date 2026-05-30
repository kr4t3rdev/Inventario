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
import { BackupEngine, validateBackupFile } from './backup-engine'
import { RestoreEngine } from './restore-engine'
import { createStorage } from './storage'
import {
  createBackupSchema,
  deleteBackupSchema,
  restoreBackupSchema,
  getBackupsSchema,
  importBackupSchema,
} from './schemas'
import type {
  CreateBackupInput,
  RestoreBackupInput,
  GetBackupsInput,
  ImportBackupInput,
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

    // Create BackupLog synchronously (before fire-and-forget engine execution)
    // so the action can return the backupLogId immediately without a race condition.
    const log = await prisma.backupLog.create({
      data: {
        type: parsed.type,
        tenantId: parsed.tenantId ?? null,
        status: 'running',
        createdBy: user.userId,
      },
      select: { backupLogId: true },
    })

    // Instantiate engine and start backup in background
    const engine = new BackupEngine({
      storage: createStorage(),
    })

    // Fire-and-forget: the backup runs asynchronously.
    // The engine receives the existing backupLogId and updates it as it progresses.
    void engine
      .run(
        { type: parsed.type, tenantId: parsed.tenantId },
        log.backupLogId,
        undefined,
        user.userId,
      )
      .then(() => revalidatePath('/admin/backups'))
      .catch((err) => {
        console.error('[createBackupAction] Backup failed:', err)
      })

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

// ─── Import External Backup ─────────────────────────────────

/**
 * @description Imports an external .sql.gz backup file by downloading from a URL.
 * Validates the file (gzip + SQL content), stores it, and creates a BackupLog
 * with type='imported' and status='completed'.
 *
 * For file upload (multipart), use POST /api/backups/import instead.
 *
 * Auth: admin only
 */
export const importBackupAction = withAction(
  async (input: ImportBackupInput, user: AuthenticatedUser) => {
    if (user.role !== 'admin') {
      throw new ActionError('Acceso restringido', 'FORBIDDEN')
    }

    const parsed = importBackupSchema.parse(input)

    if (!parsed.url) {
      throw new ActionError(
        'Se requiere una URL para importar',
        'VALIDATION_ERROR',
      )
    }

    // Download the file
    let response: Response
    try {
      response = await fetch(parsed.url)
      if (!response.ok) {
        throw new ActionError(
          `No se pudo descargar el archivo (${response.status})`,
          'DOWNLOAD_FAILED',
        )
      }
    } catch (err) {
      if (err instanceof ActionError) throw err
      throw new ActionError(
        'No se pudo conectar con la URL proporcionada',
        'DOWNLOAD_FAILED',
      )
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    // Validate file
    const validation = validateBackupFile(buffer)
    if (!validation.valid) {
      throw new ActionError(
        validation.error ?? 'Archivo de backup inv\u00e1lido',
        'VALIDATION_ERROR',
      )
    }

    // Build filename and store
    const storage = createStorage()
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19)
    const storagePath = `imported_${timestamp}.sql.gz`

    const fileUrl = await storage.save(storagePath, buffer)
    const fileSize = parsed.fileSize ?? buffer.length

    // Create BackupLog — imported files are immediately completed
    const log = await prisma.backupLog.create({
      data: {
        type: 'imported',
        status: 'completed',
        fileUrl,
        fileName: storagePath,
        fileSize,
        createdBy: user.userId,
        completedAt: new Date(),
      },
      select: { backupLogId: true },
    })

    revalidatePath('/admin/backups')
    return { backupLogId: log.backupLogId, type: 'imported' }
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

    let downloadUrl: string

    if (process.env.BACKUP_STORAGE === 'blob') {
      // Vercel Blob provides actual signed HTTPS URLs
      const storage = createStorage()
      downloadUrl = await storage.getDownloadUrl(log.fileName)
    } else {
      // LocalFS: use the authenticated API route — the client will prepend origin
      downloadUrl = `/api/backups/download?backupLogId=${input.backupLogId}`
    }

    // Extract basename from storage path (e.g. 'backups/full_xxx.sql.gz' → 'full_xxx.sql.gz')
    const fileName = log.fileName.split('/').pop() ?? log.fileName
    return { downloadUrl, fileName }
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
      log.type === 'full' || log.type === 'imported' ? 'FULL RESTORE' : 'RESTORE'

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
