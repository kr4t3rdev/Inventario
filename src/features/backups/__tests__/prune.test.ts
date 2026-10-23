import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma, storageDelete } = vi.hoisted(() => ({
  mockPrisma: { backupLog: { findMany: vi.fn(), updateMany: vi.fn() } },
  storageDelete: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/db/platform-prisma', () => ({ prismaPlatform: mockPrisma }))
vi.mock('../storage', () => ({ createStorage: () => ({ delete: storageDelete }) }))

import { prisma } from '@/lib/prisma'
import { pruneBackups } from '../prune'

describe('pruneBackups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.backupLog.findMany).mockResolvedValue([
      { backupLogId: 'log-1', fileName: 'tenant-backup.gz' },
    ] as never)
    vi.mocked(prisma.backupLog.updateMany).mockResolvedValue({ count: 1 } as never)
    storageDelete.mockResolvedValue(undefined)
  })

  it('limits tenant pruning and status mutation to its tenant records', async () => {
    const result = await pruneBackups(30, { kind: 'tenant', tenantId: 'tenant-1' })

    expect(prisma.backupLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ type: 'tenant', tenantId: 'tenant-1' }),
    }))
    expect(prisma.backupLog.updateMany).toHaveBeenCalledWith({
      where: {
        backupLogId: 'log-1', type: 'tenant', tenantId: 'tenant-1', status: 'completed',
      },
      data: { status: 'pruned' },
    })
    expect(storageDelete).toHaveBeenCalledWith('tenant-backup.gz')
    expect(result).toEqual({ pruned: 1, failed: 0 })
  })

  it('limits global pruning to the authorized matching type and null tenant', async () => {
    await pruneBackups(14, { kind: 'global', type: 'config' })

    expect(prisma.backupLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ type: 'config', tenantId: null }),
    }))
    expect(prisma.backupLog.updateMany).toHaveBeenCalledWith({
      where: {
        backupLogId: 'log-1', type: 'config', tenantId: null, status: 'completed',
      },
      data: { status: 'pruned' },
    })
  })

  it('does not delete storage when the scoped log update matches no row', async () => {
    vi.mocked(prisma.backupLog.updateMany).mockResolvedValue({ count: 0 } as never)

    const result = await pruneBackups(30, { kind: 'tenant', tenantId: 'tenant-1' })

    expect(storageDelete).not.toHaveBeenCalled()
    expect(result).toEqual({ pruned: 0, failed: 1 })
  })

  it('does not delete storage when the scoped log update fails', async () => {
    vi.mocked(prisma.backupLog.updateMany).mockRejectedValue(new Error('write failed'))

    const result = await pruneBackups(30, { kind: 'tenant', tenantId: 'tenant-1' })

    expect(storageDelete).not.toHaveBeenCalled()
    expect(result).toEqual({ pruned: 0, failed: 1 })
  })

  it('reports failed partial cleanup when storage deletion fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    storageDelete.mockRejectedValue(new Error('storage unavailable'))

    const result = await pruneBackups(30, { kind: 'tenant', tenantId: 'tenant-1' })

    expect(result).toEqual({ pruned: 0, failed: 1 })
    expect(log).toHaveBeenCalledWith(
      '[pruneBackups] Failed to delete file tenant-backup.gz:',
      expect.any(Error),
    )
    log.mockRestore()
  })
})
