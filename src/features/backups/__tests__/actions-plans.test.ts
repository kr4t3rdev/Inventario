import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    backupPlan: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { updatePlanAction } from '../actions-plans'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

const mockUser: AuthenticatedUser = {
  userId: 'admin-1',
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin',
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
    vi.mocked(prisma.backupPlan.update).mockImplementation(async ({ data }) => ({
      backupPlanId: 'plan-1',
      ...data,
    }) as never)
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
})
