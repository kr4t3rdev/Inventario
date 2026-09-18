import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  backupEngineRun,
  backupEngineCtor,
  calculateNextRun,
} = vi.hoisted(() => ({
  backupEngineRun: vi.fn(),
  backupEngineCtor: vi.fn(),
  calculateNextRun: vi.fn(() => new Date('2026-08-09T00:00:00.000Z')),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    backupPlan: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    backupLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/db/platform-prisma', async () => {
  const { prisma } = await import('@/lib/prisma')
  return { prismaPlatform: prisma, default: prisma }
})

vi.mock('@/features/backups/backup-engine', () => ({
  BackupEngine: class {
    constructor(options: unknown) {
      backupEngineCtor(options)
    }

    run = backupEngineRun
  },
}))

vi.mock('@/features/backups/storage', () => ({
  createStorage: vi.fn(() => ({ kind: 'mock-storage' })),
}))

vi.mock('@/features/backups/prune', () => ({
  pruneBackups: vi.fn(),
}))

vi.mock('@/features/backups/cron-utils', () => ({
  calculateNextRun,
}))

import { prisma } from '@/lib/prisma'
import { pruneBackups } from '@/features/backups/prune'
import { createStorage } from '@/features/backups/storage'
import { GET } from '../route'

describe('backup cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'test-cron-secret')
    backupEngineRun.mockResolvedValue(undefined)
    vi.mocked(prisma.backupPlan.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.backupLog.create).mockResolvedValue({
      backupLogId: 'log-1',
    } as never)
    vi.mocked(prisma.backupPlan.update).mockResolvedValue({} as never)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('fails closed when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '')

    const response = await GET(new NextRequest('http://localhost/api/cron/backups'))

    expect(response.status).toBe(500)
    expect(prisma.backupPlan.findMany).not.toHaveBeenCalled()
  })

  it('rejects a request without a cron secret', async () => {
    const response = await GET(new NextRequest('http://localhost/api/cron/backups'))

    expect(response.status).toBe(401)
    expect(prisma.backupPlan.findMany).not.toHaveBeenCalled()
  })

  it('rejects an invalid cron secret', async () => {
    const response = await GET(new NextRequest(
      'http://localhost/api/cron/backups',
      { headers: { authorization: 'Bearer wrong-secret' } },
    ))

    expect(response.status).toBe(401)
    expect(prisma.backupPlan.findMany).not.toHaveBeenCalled()
  })

  it('processes a due plan with a valid cron secret', async () => {
    vi.mocked(prisma.backupPlan.findMany).mockResolvedValue([
      {
        backupPlanId: 'plan-1',
        type: 'full',
        tenantId: null,
        schedule: 'hourly',
        retention: 30,
        createdBy: 'admin-1',
      },
    ] as never)

    const response = await GET(new NextRequest(
      'http://localhost/api/cron/backups',
      { headers: { authorization: 'Bearer test-cron-secret' } },
    ))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toMatchObject({ executed: 1, failed: 0 })
    expect(createStorage).toHaveBeenCalledTimes(1)
    expect(prisma.backupLog.create).toHaveBeenCalledTimes(1)
    expect(prisma.backupLog.create).toHaveBeenCalledWith({
      data: {
        type: 'full',
        tenantId: undefined,
        status: 'running',
        createdBy: 'admin-1',
      },
      select: { backupLogId: true },
    })
    expect(backupEngineCtor).toHaveBeenCalledTimes(1)
    expect(backupEngineRun).toHaveBeenCalledWith(
      { type: 'full', tenantId: undefined },
      'log-1',
      undefined,
      'admin-1',
    )
    expect(prisma.backupPlan.update).toHaveBeenCalledWith({
      where: { backupPlanId: 'plan-1' },
      data: {
        lastRunAt: expect.any(Date),
        nextRunAt: expect.any(Date),
      },
    })
    expect(calculateNextRun).toHaveBeenCalledWith('hourly')
    expect(pruneBackups).toHaveBeenCalledWith(30)
  })

  it('accepts the x-cron-secret header', async () => {
    const response = await GET(new NextRequest(
      'http://localhost/api/cron/backups',
      { headers: { 'x-cron-secret': 'test-cron-secret' } },
    ))

    expect(response.status).toBe(200)
    expect(prisma.backupPlan.findMany).toHaveBeenCalledTimes(1)
  })

  it('processes plans sequentially and preserves the summary response', async () => {
    const events: string[] = []
    let activeBackups = 0
    let maxActiveBackups = 0

    vi.mocked(prisma.backupPlan.findMany).mockResolvedValue([
      {
        backupPlanId: 'plan-1',
        type: 'full',
        tenantId: 'tenant-1',
        schedule: 'hourly',
        retention: 10,
        createdBy: 'admin-1',
      },
      {
        backupPlanId: 'plan-2',
        type: 'config',
        tenantId: null,
        schedule: 'daily',
        retention: 20,
        createdBy: 'admin-2',
      },
    ] as never)
    vi.mocked(prisma.backupLog.create)
      .mockResolvedValueOnce({ backupLogId: 'log-1' } as never)
      .mockResolvedValueOnce({ backupLogId: 'log-2' } as never)
    backupEngineRun.mockImplementation(async () => {
      events.push('start')
      activeBackups++
      maxActiveBackups = Math.max(maxActiveBackups, activeBackups)
      await new Promise((resolve) => setTimeout(resolve, 0))
      activeBackups--
      events.push('end')
    })

    const response = await GET(new NextRequest(
      'http://localhost/api/cron/backups',
      { headers: { authorization: 'Bearer test-cron-secret' } },
    ))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toMatchObject({ executed: 2, failed: 0 })
    expect(maxActiveBackups).toBe(1)
    expect(events).toEqual(['start', 'end', 'start', 'end'])
    expect(prisma.backupLog.create).toHaveBeenCalledTimes(2)
    expect(backupEngineRun).toHaveBeenNthCalledWith(
      1,
      { type: 'full', tenantId: 'tenant-1' },
      'log-1',
      undefined,
      'admin-1',
    )
    expect(backupEngineRun).toHaveBeenNthCalledWith(
      2,
        { type: 'config', tenantId: undefined },
      'log-2',
      undefined,
      'admin-2',
    )
  })
})
