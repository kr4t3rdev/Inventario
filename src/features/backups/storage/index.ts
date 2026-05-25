/**
 * @description Storage adapter factory.
 * Selects the storage backend based on BACKUP_STORAGE env var.
 */
import type { BackupStorage } from './types'

export type { BackupStorage } from './types'

/**
 * @description Creates and returns the appropriate storage adapter.
 * Default: localfs (Railway Volume / local filesystem).
 */
export function createStorage(): BackupStorage {
  const mode = process.env.BACKUP_STORAGE || 'localfs'

  if (mode === 'localfs') {
    const { LocalFSStorage } = require('./localfs-storage')
    return new LocalFSStorage()
  }

  if (mode === 'blob') {
    const { VercelBlobStorage } = require('./blob-storage')
    return new VercelBlobStorage()
  }

  throw new Error(`Unknown BACKUP_STORAGE mode: ${mode}. Use 'localfs' or 'blob'.`)
}
