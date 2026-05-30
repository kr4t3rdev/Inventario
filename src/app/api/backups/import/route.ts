/**
 * @description API route for importing external .sql.gz backup files via file upload.
 * Uses multipart form data. Validates the file (gzip + SQL), stores it in backup
 * storage, and creates a BackupLog with type='imported' and status='completed'.
 *
 * @module api/backups/import
 */
import { NextRequest, NextResponse } from 'next/server'
import { withAuthPost } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { createStorage } from '@/features/backups/storage'
import { validateBackupFile } from '@/features/backups/backup-engine'
import { revalidatePath } from 'next/cache'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB

export const POST = withAuthPost(async (request: NextRequest, _context, user) => {
  // Only admins can import backups
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No se envió ningún archivo' },
        { status: 400 },
      )
    }

    // Size check
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error:
            'El archivo excede el tamaño máximo de 100 MB',
        },
        { status: 413 },
      )
    }

    // Read file into buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Validate gzip + SQL content
    const validation = validateBackupFile(buffer)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error ?? 'Archivo de backup inválido' },
        { status: 422 },
      )
    }

    // Store to backup storage
    const storage = createStorage()
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19)
    const storagePath = `imported_${timestamp}.sql.gz`
    const fileUrl = await storage.save(storagePath, buffer)

    // Create BackupLog — imported files are immediately completed
    const log = await prisma.backupLog.create({
      data: {
        type: 'imported',
        status: 'completed',
        fileUrl,
        fileName: storagePath,
        fileSize: buffer.length,
        createdBy: user.userId,
        completedAt: new Date(),
      },
      select: { backupLogId: true },
    })

    revalidatePath('/admin/backups')

    return NextResponse.json({
      backupLogId: log.backupLogId,
      type: 'imported',
    })
  } catch (err) {
    console.error('[import/route] Error importing backup:', err)
    return NextResponse.json(
      { error: 'Error interno al importar la copia de seguridad' },
      { status: 500 },
    )
  }
})
