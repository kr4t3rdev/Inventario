/**
 * @description Vercel Blob storage adapter for backups.
 * Optional adapter for Vercel deployments. Requires @vercel/blob to be installed.
 *
 * The factory will only instantiate this adapter when BACKUP_STORAGE=blob,
 * so the package dependency is optional at runtime.
 */
import { Readable } from 'stream'
import { basename } from 'path'
import type { BackupStorage } from './types'

export class VercelBlobStorage implements BackupStorage {
  private readonly basePath: string

  constructor(basePath?: string) {
    this.basePath = basePath ?? process.env.BACKUP_BLOB_PREFIX ?? 'backups'
  }

  private async getClient() {
    // @vercel/blob is optional — error at runtime if not installed
    // @ts-expect-error - optional peer dependency
    return (await import('@vercel/blob')) as {
      put(pathname: string, body: Buffer, opts?: { access: string; addRandomSuffix?: boolean }): Promise<{ url: string }>
      download(url: string): Promise<{ body: ReadableStream<Uint8Array> | null }>
      del(url: string): Promise<void>
      list(opts?: { prefix?: string }): Promise<{ blobs: Array<{ pathname: string; url: string }> }>
      head(url: string): Promise<{ url: string }>
    }
  }

  private buildKey(storagePath: string): string {
    return `${this.basePath}/${storagePath.replace(/^\//, '')}`
  }

  async save(storagePath: string, buffer: Buffer): Promise<string> {
    const { put } = await this.getClient()
    const key = this.buildKey(storagePath)
    const result = await put(key, buffer, {
      access: 'public',
      addRandomSuffix: false,
    })
    return result.url
  }

  async get(storagePath: string): Promise<Readable> {
    const { download } = await this.getClient()
    const key = this.buildKey(storagePath)
    const response = await download(key)

    if (!response.body) {
      throw new Error(`Empty response body for blob: ${key}`)
    }

    // Convert web ReadableStream to Node.js Readable via reader
    const reader = response.body.getReader()
    return new Readable({
      async read() {
        try {
          const { done, value } = await reader.read()
          if (done) return this.push(null)
          this.push(Buffer.from(value))
        } catch (err) {
          this.destroy(err as Error)
        }
      },
    })
  }

  async delete(storagePath: string): Promise<void> {
    const { del } = await this.getClient()
    const key = this.buildKey(storagePath)
    await del(key)
  }

  async list(prefix?: string): Promise<string[]> {
    const { list } = await this.getClient()
    const result = await list({
      prefix: prefix ? this.buildKey(prefix) : this.basePath,
    })
    return result.blobs.map((b) => b.pathname)
  }

  async getDownloadUrl(storagePath: string): Promise<string> {
    const { head } = await this.getClient()
    const key = this.buildKey(storagePath)
    const blob = await head(key)
    return blob.url
  }

  getFileName(url: string): string {
    return basename(url.split('?')[0])
  }
}
