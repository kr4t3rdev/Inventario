/**
 * @description API route to serve backup file downloads with auth protection.
 * Required because LocalFS storage returns file:// paths that can't be opened
 * from browser context. This route reads the file and streams it to the client.
 *
 * @module api/backups/download
 */
import { NextResponse } from 'next/server'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { join } from 'path'
import { withAuthGet } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

export const GET = withAuthGet(async (request, _context, user) => {
  // Only admins can download backups
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const backupLogId = searchParams.get('backupLogId')

  if (!backupLogId) {
    return NextResponse.json({ error: 'backupLogId es requerido' }, { status: 400 })
  }

  const log = await prisma.backupLog.findUnique({
    where: { backupLogId },
    select: { fileName: true, status: true },
  })

  if (!log) {
    return NextResponse.json({ error: 'Copia de seguridad no encontrada' }, { status: 404 })
  }

  if (log.status !== 'completed') {
    return NextResponse.json({ error: 'La copia no está disponible para descarga' }, { status: 400 })
  }

  if (!log.fileName) {
    return NextResponse.json({ error: 'Archivo no disponible' }, { status: 404 })
  }

  // Resolve file path — same logic as LocalFSStorage
  const backupDir = process.env.BACKUP_DIR ?? './backups'
  const normalized = join('/', log.fileName).replace(/^\/+/, '')
  const filePath = join(backupDir, normalized)

  let fileStats
  try {
    fileStats = await stat(filePath)
  } catch {
    return NextResponse.json({ error: 'Archivo no encontrado en el servidor' }, { status: 404 })
  }

  const stream = createReadStream(filePath)
  const filename = log.fileName.split('/').pop() ?? log.fileName

  return new NextResponse(stream as any, {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(fileStats.size),
    },
  })
})
