/**
 * @description Unit tests for LocalFSStorage — pure filesystem operations.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Readable } from 'stream'
import { mkdtempSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { LocalFSStorage } from '../storage/localfs-storage'

/** Collect a Readable stream into a Buffer */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

describe('LocalFSStorage', () => {
  let tmpDir: string
  let storage: LocalFSStorage

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'backups-test-'))
    storage = new LocalFSStorage(tmpDir)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('saves a file to disk and returns the full path', async () => {
    const data = Buffer.from('hello backup')
    const url = await storage.save('test/full_backup.sql.gz', data)

    expect(url).toBeDefined()
    expect(existsSync(url)).toBe(true)
    expect(url).toContain('full_backup.sql.gz')
  })

  it('retrieves a saved file as a readable stream', async () => {
    const original = Buffer.from('restore me')
    await storage.save('test/data.sql.gz', original)

    const stream = await storage.get('test/data.sql.gz')
    const retrieved = await streamToBuffer(stream)
    expect(retrieved.equals(original)).toBe(true)
  })

  it('creates a stream that errors on read for non-existent file', async () => {
    const stream = await storage.get('nonexistent.sql.gz')
    await expect(streamToBuffer(stream)).rejects.toThrow(/ENOENT/)
  })

  it('deletes an existing file', async () => {
    await storage.save('test/tmp.sql.gz', Buffer.from('data'))
    const fullPath = join(tmpDir, 'test/tmp.sql.gz')
    expect(existsSync(fullPath)).toBe(true)

    await storage.delete('test/tmp.sql.gz')
    expect(existsSync(fullPath)).toBe(false)
  })

  it('throws when deleting a non-existent file', async () => {
    await expect(storage.delete('nonexistent.sql.gz')).rejects.toThrow(/ENOENT/)
  })

  it('lists files in the base directory', async () => {
    await storage.save('full_a.sql.gz', Buffer.from('a'))
    await storage.save('full_b.sql.gz', Buffer.from('b'))
    await storage.save('tenant_c.sql.gz', Buffer.from('c'))

    const files = await storage.list()
    expect(files).toContain('full_a.sql.gz')
    expect(files).toContain('full_b.sql.gz')
    expect(files).toContain('tenant_c.sql.gz')
    expect(files.length).toBeGreaterThanOrEqual(3)
  })

  it('filters files by prefix', async () => {
    await storage.save('full_a.sql.gz', Buffer.from('a'))
    await storage.save('tenant_c.sql.gz', Buffer.from('c'))

    const filtered = await storage.list('full_')
    expect(filtered).toHaveLength(1)
    expect(filtered[0]).toBe('full_a.sql.gz')
  })

  it('returns a file:// download URL', async () => {
    await storage.save('backups/download_test.sql.gz', Buffer.from('download'))
    const url = await storage.getDownloadUrl('backups/download_test.sql.gz')
    expect(url).toMatch(/^file:\/\//)
    expect(url).toContain('download_test.sql.gz')
  })

  it('extracts filename from a full path URL', () => {
    const name = storage.getFileName('/backups/full_acme_2026-01-01.sql.gz')
    expect(name).toBe('full_acme_2026-01-01.sql.gz')
  })

  it('handles a moderately large file using streaming', async () => {
    const largeData = Buffer.alloc(1024 * 64, 'x') // 64KB
    await storage.save('test/large.sql.gz', largeData)

    const stream = await storage.get('test/large.sql.gz')
    const retrieved = await streamToBuffer(stream)
    expect(retrieved.length).toBe(1024 * 64)
  })

  it('creates intermediate directories when saving to subpaths', async () => {
    await storage.save('nested/a/b/c/backup.sql.gz', Buffer.from('nested'))
    const fullPath = join(tmpDir, 'nested/a/b/c/backup.sql.gz')
    expect(existsSync(fullPath)).toBe(true)
  })
})
