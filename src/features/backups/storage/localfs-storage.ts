/**
 * @description Local filesystem storage adapter for backups.
 * Writes backup files to a local directory (BACKUP_DIR or ./backups).
 * Primary adapter for Railway Volumes and local development.
 */
import { createReadStream } from 'fs'
import { mkdir, readdir, unlink, writeFile } from 'fs/promises'
import { join, basename, dirname } from 'path'
import type { Readable } from 'stream'
import type { BackupStorage } from './types'

export class LocalFSStorage implements BackupStorage {
  private readonly baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? process.env.BACKUP_DIR ?? './backups'
  }

  private resolvePath(storagePath: string): string {
    // Prevent directory traversal
    const normalized = join('/', storagePath).replace(/^\/+/, '')
    return join(this.baseDir, normalized)
  }

  async save(storagePath: string, buffer: Buffer): Promise<string> {
    const fullPath = this.resolvePath(storagePath)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, buffer)
    return fullPath
  }

  async get(storagePath: string): Promise<Readable> {
    const fullPath = this.resolvePath(storagePath)
    return createReadStream(fullPath)
  }

  async delete(storagePath: string): Promise<void> {
    const fullPath = this.resolvePath(storagePath)
    await unlink(fullPath)
  }

  async list(prefix?: string): Promise<string[]> {
    await mkdir(this.baseDir, { recursive: true })
    const entries = await readdir(this.baseDir, { withFileTypes: true })
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort()
    if (!prefix) return files
    return files.filter((f) => f.startsWith(prefix))
  }

  async getDownloadUrl(storagePath: string): Promise<string> {
    const fullPath = this.resolvePath(storagePath)
    return `file://${fullPath}`
  }

  getFileName(url: string): string {
    return basename(url)
  }
}
