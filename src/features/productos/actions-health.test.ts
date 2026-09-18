import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: { count: vi.fn() },
    categoria: { count: vi.fn() },
    unidad: { count: vi.fn() },
    vendor: { count: vi.fn() },
    puntoDeVenta: { count: vi.fn() },
    listaPrecio: { count: vi.fn() },
  },
}))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { getMastersHealthAction } from './actions-health'

const adminUser = {
  userId: 'admin-1',
  name: 'Admin',
  email: 'admin@example.com',
  role: 'admin' as const,
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager' as const,
}

/**
 * @description Verifica el contrato de la salud de datos maestros del tenant activo.
 * @returns {void}
 */
describe('getMastersHealthAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna los seis conteos limitados al tenant del admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser)
    vi.mocked(prisma.producto.count).mockResolvedValue(12)
    vi.mocked(prisma.categoria.count).mockResolvedValue(3)
    vi.mocked(prisma.unidad.count).mockResolvedValue(4)
    vi.mocked(prisma.vendor.count).mockResolvedValue(5)
    vi.mocked(prisma.puntoDeVenta.count).mockResolvedValue(2)
    vi.mocked(prisma.listaPrecio.count).mockResolvedValue(1)

    const result = await getMastersHealthAction()

    expect(result).toEqual({
      success: true,
      data: {
        metrics: {
          productos: 12,
          categorias: 3,
          unidades: 4,
          proveedores: 5,
          puntosDeVenta: 2,
          listasPrecio: 1,
        },
      },
    })
    expect(prisma.producto.count).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1' } })
    expect(prisma.categoria.count).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1' } })
    expect(prisma.unidad.count).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1' } })
    expect(prisma.vendor.count).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1' } })
    expect(prisma.puntoDeVenta.count).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1' } })
    expect(prisma.listaPrecio.count).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1' } })
  })

  it('rechaza a un usuario que no es admin antes de consultar la base', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...adminUser, role: 'regularUser' })

    const result = await getMastersHealthAction()

    expect(result).toEqual({
      success: false,
      error: {
        message: 'No tienes permisos para consultar la salud operativa.',
        code: 'FORBIDDEN',
      },
    })
    expect(prisma.producto.count).not.toHaveBeenCalled()
  })

  it('rechaza a un admin sin membresía de tenant antes de consultar la base', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...adminUser, tenantId: undefined })

    const result = await getMastersHealthAction()

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('INTERNAL_ERROR')
    expect(prisma.producto.count).not.toHaveBeenCalled()
  })

  it('retorna ceros cuando el tenant no tiene datos maestros', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser)
    vi.mocked(prisma.producto.count).mockResolvedValue(0)
    vi.mocked(prisma.categoria.count).mockResolvedValue(0)
    vi.mocked(prisma.unidad.count).mockResolvedValue(0)
    vi.mocked(prisma.vendor.count).mockResolvedValue(0)
    vi.mocked(prisma.puntoDeVenta.count).mockResolvedValue(0)
    vi.mocked(prisma.listaPrecio.count).mockResolvedValue(0)

    const result = await getMastersHealthAction()

    expect(result).toEqual({
      success: true,
      data: {
        metrics: {
          productos: 0,
          categorias: 0,
          unidades: 0,
          proveedores: 0,
          puntosDeVenta: 0,
          listasPrecio: 0,
        },
      },
    })
  })
})
