import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCuentasPorPagarAction } from '@/features/contabilidad/actions-cuentas'

const listPayablesMock = vi.hoisted(() => vi.fn())
vi.mock('@/features/contabilidad/services/accounting-accounts-service', () => ({
  AccountingAccountsService: { listPayables: listPayablesMock },
}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

const getCurrentUserMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Cuentas por Pagar — lectura de deuda existente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentUserMock.mockResolvedValue({
      userId: 'user-basic',
      tenantId: 'tenant-1',
      name: 'Basic user',
      email: 'basic@test.com',
      role: 'manager',
      isActive: true,
      permissions: new Set(['financiero.contabilidad.acceder']),
      planFeatures: { contabilidad: true, 'cuentas-pagar': false },
    })
    listPayablesMock.mockResolvedValue({ cuentas: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } })
  })

  it('allows Basic users to consult existing payables without enabling account creation', async () => {
    const result = await getCuentasPorPagarAction({})

    expect(result.success).toBe(true)
    expect(listPayablesMock).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1' }))
  })

  it('rejects queries when the user lacks accounting permission', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'user-basic',
      tenantId: 'tenant-1',
      name: 'Basic user',
      email: 'basic@test.com',
      role: 'manager',
      isActive: true,
      permissions: new Set<string>(),
      planFeatures: { contabilidad: true, 'cuentas-pagar': false },
    })

    const result = await getCuentasPorPagarAction({})

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('FORBIDDEN')
    expect(listPayablesMock).not.toHaveBeenCalled()
  })
})
