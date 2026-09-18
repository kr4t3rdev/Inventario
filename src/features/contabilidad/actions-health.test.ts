import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/prisma', () => ({ prisma: { periodoContable: { count: vi.fn(), findFirst: vi.fn() } } }))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { getAccountingHealthAction } from './actions-health'

const admin = { userId: 'a', name: 'a', email: 'a@a.com', role: 'admin' as const, isActive: true, tenantId: 't', tenantRole: 'manager' as const }

describe('getAccountingHealthAction', () => {
  it('retorna periodo activo y cierre', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin)
    vi.mocked(prisma.periodoContable.count).mockResolvedValue(3)
    vi.mocked(prisma.periodoContable.findFirst)
      .mockResolvedValueOnce({ codigo: '2026-01', estado: 'ABIERTO' })
      .mockResolvedValueOnce({ codigo: '2025-12' })
    await expect(getAccountingHealthAction()).resolves.toEqual({
      success: true,
      data: { metrics: { hasActivePeriod: true, currentPeriodStatus: 'ABIERTO', lastClosedPeriod: '2025-12', totalPeriods: 3 } },
    })
  })

  it('retorna bloqueado sin periodo activo', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin)
    vi.mocked(prisma.periodoContable.count).mockResolvedValue(0)
    vi.mocked(prisma.periodoContable.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    const result = await getAccountingHealthAction()
    expect(result.success && result.data?.metrics.hasActivePeriod).toBe(false)
  })
})