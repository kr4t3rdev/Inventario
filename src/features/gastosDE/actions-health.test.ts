// Test stub: RED pending implementation
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/prisma', () => ({ prisma: { gastosDE: { count: vi.fn(), aggregate: vi.fn() } } }))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { getExpenseHealthAction } from './actions-health'

const admin = { userId: 'a', name: 'a', email: 'a@a.com', role: 'admin' as const, isActive: true, tenantId: 't', tenantRole: 'manager' as const }

describe('getExpenseHealthAction', () => {
  it('retorna count y total del tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin)
    vi.mocked(prisma.gastosDE.count).mockResolvedValue(3)
    vi.mocked(prisma.gastosDE.aggregate).mockResolvedValue({ _sum: { monto: 750 } } as never)
    await expect(getExpenseHealthAction()).resolves.toEqual({ success: true, data: { metrics: { gastosCount: 3, gastosTotal: 750 } } })
  })
})