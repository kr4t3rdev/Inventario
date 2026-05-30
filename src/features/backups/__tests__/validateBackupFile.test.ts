/**
 * @description Unit tests for validateBackupFile — gzip magic bytes + SQL content validation.
 *
 * @module features/backups/__tests__/validateBackupFile.test
 */
import { describe, it, expect } from 'vitest'
import { gzipSync } from 'zlib'
import { validateBackupFile } from '../backup-engine'

function gzip(content: string): Buffer {
  return gzipSync(Buffer.from(content, 'utf-8'))
}

describe('validateBackupFile', () => {
  it('should accept a valid .sql.gz file', () => {
    const buffer = gzip('-- TCP Database Backup\nCREATE TABLE test (id int);')
    const result = validateBackupFile(buffer)
    expect(result.valid).toBe(true)
  })

  it('should accept SQL starting with INSERT', () => {
    const buffer = gzip('INSERT INTO users VALUES (1);')
    const result = validateBackupFile(buffer)
    expect(result.valid).toBe(true)
  })

  it('should accept SQL starting with SET', () => {
    const buffer = gzip('SET session_replication_role = replica;')
    const result = validateBackupFile(buffer)
    expect(result.valid).toBe(true)
  })

  it('should accept SQL starting with BEGIN', () => {
    const buffer = gzip('BEGIN;\nINSERT INTO test VALUES (1);\nCOMMIT;')
    const result = validateBackupFile(buffer)
    expect(result.valid).toBe(true)
  })

  it('should reject a non-gzip file', () => {
    const buffer = Buffer.from('not a gzip file', 'utf-8')
    const result = validateBackupFile(buffer)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('.sql.gz')
  })

  it('should reject an empty gzip file', () => {
    const buffer = gzip('')
    const result = validateBackupFile(buffer)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('vacío')
  })

  it('should reject gzip with non-SQL content', () => {
    const buffer = gzip('hello world this is not SQL')
    const result = validateBackupFile(buffer)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('SQL')
  })

  it('should reject a very short buffer (no gzip magic)', () => {
    const buffer = Buffer.from([0x00, 0x00])
    const result = validateBackupFile(buffer)
    expect(result.valid).toBe(false)
  })

  it('should reject corrupted gzip data', () => {
    // Valid gzip header but corrupted body
    const header = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0b])
    const corrupted = Buffer.concat([header, Buffer.from('corrupted', 'utf-8')])
    const result = validateBackupFile(corrupted)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('descomprimir')
  })
})
