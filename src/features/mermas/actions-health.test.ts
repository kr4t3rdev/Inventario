import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/prisma', () => ({ prisma: { merma: { count: vi.fn(), aggregate: vi.fn() } } }))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { getWastageHealthAction } from './actions-health'

const admin = { userId: 'a', name: 'a', email: 'a@a.com', role: 'admin' as const, isActive: true, tenantId: 't', tenantRole: 'manager' as const }

describe('getWastageHealthAction', () => {
  it('retorna métricas del tenant con suma de costo', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin)
    vi.mocked(prisma.merma.count).mockResolvedValue(5)
    vi.mocked(prisma.merma.aggregate).mockResolvedValue({ _sum: { costoTotal: 500 } } as never)
    await expect(getWastageHealthAction()).resolves.toEqual({ success: true, data: { metrics: { mermasCount: 5, mermasTotalValue: 500 } } })
  })
})