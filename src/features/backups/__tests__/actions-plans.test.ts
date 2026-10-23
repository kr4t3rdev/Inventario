import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/services/tenant-scope', () => ({
  requireFeature: vi.fn(),
  requireTenant: (user: AuthenticatedUser) => user.tenantId,
}))

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    tenant: { findUnique: vi.fn() },
    backupPlan: {
      findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(),
      update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(),
    },
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/db/platform-prisma', () => ({ prismaPlatform: mockPrisma }))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { createPlanAction, deletePlanAction, getPlansAction, updatePlanAction } from '../actions-plans'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

const mockUser: AuthenticatedUser = {
  userId: 'admin-1',
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin',
  isActive: true,
}
const tenantUser: AuthenticatedUser = {
  userId: 'user-1',
  name: 'Tenant user',
  email: 'user@test.com',
  role: 'regularUser',
  tenantId: 'tenant-1',
  isActive: true,
}

describe('backup plan actions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-24T10:07:00.000Z'))
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.backupPlan.findUnique).mockResolvedValue({
      backupPlanId: 'plan-1',
      type: 'full',
      tenantId: null,
      schedule: 'hourly',
      enabled: false,
      retention: 30,
    } as never)
    vi.mocked(prisma.backupPlan.findFirst).mockResolvedValue({
      backupPlanId: 'plan-1', type: 'full', tenantId: null,
      schedule: 'hourly', enabled: false, retention: 30,
    } as never)
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ tenantId: 'tenant-1' } as never)
    vi.mocked(prisma.backupPlan.update).mockImplementation(
      (async ({ data }: any) => ({
        backupPlanId: 'plan-1',
        ...data,
      })) as never,
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('recalculates nextRunAt when re-enabling a disabled plan', async () => {
    const result = await updatePlanAction({
      planId: 'plan-1',
      enabled: true,
    })

    expect(result.success).toBe(true)
    expect(prisma.backupPlan.update).toHaveBeenCalledWith({
      where: { backupPlanId: 'plan-1' },
      data: {
        enabled: true,
        nextRunAt: expect.any(Date),
      },
    })
  })

  it('recalculates nextRunAt when changing the schedule', async () => {
    vi.mocked(prisma.backupPlan.findUnique).mockResolvedValue({
      backupPlanId: 'plan-1',
      type: 'full',
      tenantId: null,
      schedule: 'hourly',
      enabled: true,
      retention: 30,
    } as never)

    const result = await updatePlanAction({
      planId: 'plan-1',
      schedule: '*/15 * * * *',
    })

    expect(result.success).toBe(true)
    expect(prisma.backupPlan.update).toHaveBeenCalledWith({
      where: { backupPlanId: 'plan-1' },
      data: {
        schedule: '*/15 * * * *',
        nextRunAt: expect.any(Date),
      },
    })
  })

  it('denies tenant users global and foreign plan creation', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(tenantUser)

    const global = await createPlanAction({ type: 'full', schedule: 'hourly' })
    const foreign = await createPlanAction({
      type: 'tenant', tenantId: 'tenant-2', schedule: 'hourly',
    })

    expect(global.success).toBe(false)
    expect(foreign.success).toBe(false)
    expect(prisma.backupPlan.create).not.toHaveBeenCalled()
  })

  it('creates only an own-tenant plan for a tenant user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(tenantUser)
    vi.mocked(prisma.backupPlan.create).mockResolvedValue({ backupPlanId: 'plan-own' } as never)

    const result = await createPlanAction({
      type: 'tenant', tenantId: 'tenant-1', schedule: 'hourly',
    })

    expect(result.success).toBe(true)
    expect(prisma.backupPlan.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'tenant', tenantId: 'tenant-1' }),
    }))
  })

  it('lists only the actor tenant plans', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(tenantUser)
    vi.mocked(prisma.backupPlan.findMany).mockResolvedValue([] as never)

    await getPlansAction()

    expect(prisma.backupPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', type: 'tenant' },
    }))
  })

  it('hides foreign/global plans on update and does not mutate them', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(tenantUser)
    vi.mocked(prisma.backupPlan.findFirst).mockResolvedValue(null as never)

    const result = await updatePlanAction({ planId: 'foreign-plan', enabled: false })

    expect(result.success).toBe(false)
    expect(prisma.backupPlan.findFirst).toHaveBeenCalledWith({
      where: { backupPlanId: 'foreign-plan', tenantId: 'tenant-1', type: 'tenant' },
    })
    expect(prisma.backupPlan.update).not.toHaveBeenCalled()
    expect(prisma.backupPlan.updateMany).not.toHaveBeenCalled()
  })

  it('keeps tenant/type immutable when tenant user updates an own plan', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(tenantUser)
    vi.mocked(prisma.backupPlan.findFirst).mockResolvedValue({
      backupPlanId: 'plan-own', type: 'tenant', tenantId: 'tenant-1',
      schedule: 'hourly', enabled: false, retention: 30,
    } as never)
    vi.mocked(prisma.backupPlan.updateMany).mockResolvedValue({ count: 1 } as never)

    const result = await updatePlanAction({
      planId: 'plan-own', enabled: true, tenantId: 'tenant-2', type: 'full',
    } as never)

    expect(result.success).toBe(true)
    expect(prisma.backupPlan.updateMany).toHaveBeenCalledWith({
      where: { backupPlanId: 'plan-own', tenantId: 'tenant-1', type: 'tenant' },
      data: { enabled: true, nextRunAt: expect.any(Date) },
    })
  })

  it('hides foreign/global plans on delete and does not delete them', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(tenantUser)
    vi.mocked(prisma.backupPlan.deleteMany).mockResolvedValue({ count: 0 } as never)

    const result = await deletePlanAction({ planId: 'foreign-plan' })

    expect(result.success).toBe(false)
    expect(prisma.backupPlan.deleteMany).toHaveBeenCalledWith({
      where: { backupPlanId: 'foreign-plan', tenantId: 'tenant-1', type: 'tenant' },
    })
    expect(prisma.backupPlan.delete).not.toHaveBeenCalled()
  })
})
