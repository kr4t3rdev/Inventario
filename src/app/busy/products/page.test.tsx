import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getProductosAction,
  getAlmacenesAction,
  getPuntosDeVentaAction,
  getCurrentUser,
  findFirst,
} = vi.hoisted(() => ({
  getProductosAction: vi.fn(),
  getAlmacenesAction: vi.fn(),
  getPuntosDeVentaAction: vi.fn(),
  getCurrentUser: vi.fn(),
  findFirst: vi.fn(),
}))

vi.mock('@/features/productos/actions', () => ({ getProductosAction }))
vi.mock('@/features/almacenes', () => ({ getAlmacenesAction }))
vi.mock('@/features/puntos-venta', () => ({ getPuntosDeVentaAction }))
vi.mock('@/lib/server-actions', () => ({ getCurrentUser }))
vi.mock('@/lib/prisma', () => ({ prisma: { miEmpresa: { findFirst } } }))
vi.mock('@/features/productos/components/productos-content', () => ({
  ProductosContent: () => <div data-testid="productos-content" />,
}))
vi.mock('@/features/productos/components/masters-health-card', () => ({
  MastersHealthCard: () => <div data-testid="masters-health-card" />,
}))

import ProductosPage from './page'

const adminUser = {
  userId: 'admin-1',
  name: 'Admin',
  email: 'admin@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
}

/**
 * @description Verifica que la página de productos presente la salud solo al administrador global.
 * @returns {void}
 */
describe('ProductosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getProductosAction.mockResolvedValue({ success: true, data: [] })
    getAlmacenesAction.mockResolvedValue({ success: true, data: [] })
    getPuntosDeVentaAction.mockResolvedValue({ success: true, data: [] })
    findFirst.mockResolvedValue({ usaCodigoEan13: false })
  })

  it('incluye la card de salud para un admin', async () => {
    getCurrentUser.mockResolvedValue(adminUser)

    render(await ProductosPage())

    expect(screen.getByTestId('masters-health-card')).toBeInTheDocument()
    expect(screen.getByTestId('productos-content')).toBeInTheDocument()
  })

  it('no incluye la card de salud para un rol distinto de admin', async () => {
    getCurrentUser.mockResolvedValue({ ...adminUser, role: 'regularUser' })

    render(await ProductosPage())

    expect(screen.queryByTestId('masters-health-card')).not.toBeInTheDocument()
    expect(screen.getByTestId('productos-content')).toBeInTheDocument()
  })
})
