import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn((u: any) => u.tenantId),
  requireFeature: vi.fn(),
  requireManagerRole: vi.fn(),
}))
vi.mock('@/lib/cost-history-utils', () => ({
  recordCostChange: vi.fn(),
  CostChangeReason: { MANUAL_EDIT: 'MANUAL_EDIT' },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: { findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: any) => unknown) => fn({
      producto: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    })),
  },
}))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { recordCostChange } from '@/lib/cost-history-utils'
import { updatePrecioCostoAction } from '../actions'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

const mockUser: AuthenticatedUser = {
  userId: 'u-1',
  name: 'Tester',
  email: 't@test.com',
  role: 'admin' as AuthenticatedUser['role'],
  isActive: true,
  tenantId: 'tenant-A',
  tenantRole: 'manager',
}

describe('updatePrecioCostoAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rechaza si el producto no pertenece al tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue(null)
    const result = await updatePrecioCostoAction({ productoId: 'prod-1', precioCosto: 500 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('actualiza el precioCosto y registra en historial', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      precioCosto: 400,
      precioVenta: 800,
      tenantId: 'tenant-A',
    } as any)

    const result = await updatePrecioCostoAction({ productoId: 'prod-1', precioCosto: 500 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.precioCosto).toBe(500)
    }
    expect(recordCostChange).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        productoId: 'prod-1',
        oldPrecioCosto: 400,
        newPrecioCosto: 500,
        reason: 'MANUAL_EDIT',
      }),
    )
  })

  it('rechaza precioCosto negativo', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    const result = await updatePrecioCostoAction({ productoId: 'prod-1', precioCosto: -1 })
    expect(result.success).toBe(false)
  })
})
