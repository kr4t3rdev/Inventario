import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  backupEngineRun,
  backupEngineCtor,
  calculateNextRun,
  resolveTenantContext,
} = vi.hoisted(() => ({
  backupEngineRun: vi.fn(),
  backupEngineCtor: vi.fn(),
  calculateNextRun: vi.fn(() => new Date('2026-08-09T00:00:00.000Z')),
  resolveTenantContext: vi.fn(),
}))
vi.mock('@/lib/auth-middleware', () => ({ resolveTenantContext }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    backupPlan: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    backupLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    tenant: { findUnique: vi.fn() },
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
    vi.mocked(prisma.backupPlan.updateMany).mockResolvedValue({ count: 1 } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'admin', isActive: true } as never)
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ tenantId: 'tenant-1' } as never)
    resolveTenantContext.mockResolvedValue(null)
    vi.mocked(pruneBackups).mockResolvedValue({ pruned: 0, failed: 0 })
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
    expect(prisma.backupPlan.updateMany).toHaveBeenCalledWith({
      where: {
        backupPlanId: 'plan-1', type: 'full', tenantId: null,
        createdBy: 'admin-1', enabled: true,
      },
      data: {
        lastRunAt: expect.any(Date),
        nextRunAt: expect.any(Date),
      },
    })
    expect(calculateNextRun).toHaveBeenCalledWith('hourly')
    expect(pruneBackups).toHaveBeenCalledWith(30, { kind: 'global', type: 'full' })
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
        tenantId: null,
        schedule: 'hourly',
        retention: 10,
        createdBy: 'admin-1',
      },
      {
        backupPlanId: 'plan-2',
        type: 'tenant',
        tenantId: 'tenant-1',
        schedule: 'daily',
        retention: 20,
        createdBy: 'member-1',
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
    vi.mocked(prisma.user.findUnique).mockImplementation(async ({ where }: any) => ({
      role: where.userId === 'member-1' ? 'regularUser' : 'admin',
      isActive: true,
    }) as never)
    resolveTenantContext.mockResolvedValue({
      tenantId: 'tenant-1',
      tenantRole: 'manager',
      planFeatures: { 'backups-tiempo-real': true },
      permissions: new Set(),
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
      { type: 'full', tenantId: undefined },
      'log-1',
      undefined,
      'admin-1',
    )
    expect(backupEngineRun).toHaveBeenNthCalledWith(
      2,
        { type: 'tenant', tenantId: 'tenant-1' },
      'log-2',
      undefined,
      'member-1',
    )
    expect(pruneBackups).toHaveBeenNthCalledWith(1, 10, { kind: 'global', type: 'full' })
    expect(pruneBackups).toHaveBeenNthCalledWith(2, 20, {
      kind: 'tenant', tenantId: 'tenant-1',
    })
  })

  it('skips a tenant plan when its creator has no active tenant context', async () => {
    vi.mocked(prisma.backupPlan.findMany).mockResolvedValue([{
      backupPlanId: 'legacy-plan', type: 'tenant', tenantId: 'tenant-1',
      schedule: 'hourly', retention: 1, createdBy: 'regular-user',
    }] as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: 'regularUser', isActive: true,
    } as never)

    const response = await GET(new NextRequest('http://localhost/api/cron/backups', {
      headers: { authorization: 'Bearer test-cron-secret' },
    }))
    const data = await response.json()

    expect(data).toMatchObject({ executed: 0, failed: 1 })
    expect(backupEngineCtor).not.toHaveBeenCalled()
    expect(pruneBackups).not.toHaveBeenCalled()
  })

  it('rejects a tenant plan when creator membership resolves to a different tenant', async () => {
    vi.mocked(prisma.backupPlan.findMany).mockResolvedValue([{
      backupPlanId: 'foreign-plan', type: 'tenant', tenantId: 'tenant-1',
      schedule: 'hourly', retention: 1, createdBy: 'regular-user',
    }] as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: 'regularUser', isActive: true,
    } as never)
    resolveTenantContext.mockResolvedValue({
      tenantId: 'tenant-2', planFeatures: { 'backups-tiempo-real': true },
    })

    const response = await GET(new NextRequest('http://localhost/api/cron/backups', {
      headers: { authorization: 'Bearer test-cron-secret' },
    }))
    const data = await response.json()

    expect(data).toMatchObject({ executed: 0, failed: 1 })
    expect(backupEngineCtor).not.toHaveBeenCalled()
    expect(pruneBackups).not.toHaveBeenCalled()
  })

  it('allows an active platform admin tenant plan without tenant membership', async () => {
    vi.mocked(prisma.backupPlan.findMany).mockResolvedValue([{
      backupPlanId: 'admin-tenant-plan', type: 'tenant', tenantId: 'tenant-1',
      schedule: 'hourly', retention: 7, createdBy: 'admin-1',
    }] as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ role: 'admin', isActive: true } as never)
    resolveTenantContext.mockResolvedValue(null)

    const response = await GET(new NextRequest('http://localhost/api/cron/backups', {
      headers: { authorization: 'Bearer test-cron-secret' },
    }))
    const data = await response.json()

    expect(data).toMatchObject({ executed: 1, failed: 0 })
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' }, select: { tenantId: true },
    })
    expect(backupEngineRun).toHaveBeenCalledWith(
      { type: 'tenant', tenantId: 'tenant-1' }, 'log-1', undefined, 'admin-1',
    )
    expect(pruneBackups).toHaveBeenCalledWith(7, { kind: 'tenant', tenantId: 'tenant-1' })
  })

  it('rejects a tenant plan when its tenant no longer exists', async () => {
    vi.mocked(prisma.backupPlan.findMany).mockResolvedValue([{
      backupPlanId: 'deleted-tenant-plan', type: 'tenant', tenantId: 'deleted-tenant',
      schedule: 'hourly', retention: 1, createdBy: 'admin-1',
    }] as never)
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null as never)

    const response = await GET(new NextRequest('http://localhost/api/cron/backups', {
      headers: { authorization: 'Bearer test-cron-secret' },
    }))
    const data = await response.json()

    expect(data).toMatchObject({ executed: 0, failed: 1 })
    expect(backupEngineCtor).not.toHaveBeenCalled()
    expect(pruneBackups).not.toHaveBeenCalled()
  })

  it('logs a partial prune failure without masking the completed backup', async () => {
    vi.mocked(prisma.backupPlan.findMany).mockResolvedValue([{
      backupPlanId: 'plan-1', type: 'full', tenantId: null,
      schedule: 'hourly', retention: 30, createdBy: 'admin-1',
    }] as never)
    vi.mocked(pruneBackups).mockResolvedValue({ pruned: 0, failed: 1 })
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await GET(new NextRequest('http://localhost/api/cron/backups', {
      headers: { authorization: 'Bearer test-cron-secret' },
    }))
    const data = await response.json()

    expect(data).toMatchObject({ executed: 1, failed: 0 })
    expect(log).toHaveBeenCalledWith(
      '[cron/backups] Prune incomplete for plan plan-1:',
      { pruned: 0, failed: 1 },
    )
    log.mockRestore()
  })

  it('skips plans with unknown creator records before creating a backup log', async () => {
    vi.mocked(prisma.backupPlan.findMany).mockResolvedValue([{
      backupPlanId: 'orphan-plan', type: 'full', tenantId: null,
      schedule: 'hourly', retention: 1, createdBy: 'deleted-user',
    }] as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never)

    const response = await GET(new NextRequest('http://localhost/api/cron/backups', {
      headers: { authorization: 'Bearer test-cron-secret' },
    }))

    expect(response.status).toBe(200)
    expect(prisma.backupLog.create).not.toHaveBeenCalled()
    expect(backupEngineCtor).not.toHaveBeenCalled()
    expect(pruneBackups).not.toHaveBeenCalled()
  })

  it('rejects legacy global plans created by a non-admin', async () => {
    vi.mocked(prisma.backupPlan.findMany).mockResolvedValue([{
      backupPlanId: 'legacy-global-plan', type: 'full', tenantId: null,
      schedule: 'hourly', retention: 1, createdBy: 'regular-user',
    }] as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: 'regularUser', isActive: true,
    } as never)

    const response = await GET(new NextRequest('http://localhost/api/cron/backups', {
      headers: { authorization: 'Bearer test-cron-secret' },
    }))
    const data = await response.json()

    expect(data).toMatchObject({ executed: 0, failed: 1 })
    expect(prisma.backupLog.create).not.toHaveBeenCalled()
    expect(backupEngineCtor).not.toHaveBeenCalled()
    expect(pruneBackups).not.toHaveBeenCalled()
  })
})
