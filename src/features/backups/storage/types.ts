/**
 * @description Storage adapter interface for backup files.
 */
import type { Readable } from 'stream'

export interface BackupStorage {
  /** Save a buffer to storage, returns URL or path */
  save(path: string, buffer: Buffer): Promise<string>
  /** Get a readable stream of a file */
  get(path: string): Promise<Readable>
  /** Delete a file from storage */
  delete(path: string): Promise<void>
  /** List files under a prefix */
  list(prefix?: string): Promise<string[]>
  /** Generate a time-limited download URL */
  getDownloadUrl(path: string): Promise<string>
  /** Extract filename from internal URL/path */
  getFileName(url: string): string
}
