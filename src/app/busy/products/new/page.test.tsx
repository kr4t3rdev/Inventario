import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const redirectMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('@/lib/server-actions', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/features/almacenes', () => ({
  getAlmacenesAction: vi.fn(async () => ({ success: true, data: [] })),
}))

vi.mock('@/features/categorias', () => ({
  getCategoriasAction: vi.fn(async () => ({ success: true, data: [] })),
}))

vi.mock('@/features/listas-precios', () => ({
  getListasPreciosAction: vi.fn(async () => ({ success: true, data: [] })),
}))

vi.mock('@/features/unidades', () => ({
  getUnidadesAction: vi.fn(async () => ({ success: true, data: [] })),
}))

vi.mock('@/features/vendors', () => ({
  getVendorsAction: vi.fn(async () => ({ success: true, data: [] })),
}))

vi.mock('@/features/productos/components/producto-form-page-client', () => ({
  ProductoFormPageClient: () => React.createElement('div', { 'data-testid': 'producto-form' }),
}))

import { getCurrentUser } from '@/lib/server-actions'
import NuevoProductosPage from './page'

describe('NuevoProductosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirige a /busy/products cuando el usuario no es manager', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      userId: 'user-1',
      name: 'Dependiente Test',
      email: 'dep@test.com',
      role: 'regularUser' as never,
      isActive: true,
      tenantId: 'tenant-1',
      tenantRole: 'dependiente',
    } as never)

    await NuevoProductosPage()

    expect(redirectMock).toHaveBeenCalledWith('/busy/products')
  })

  it('renderiza el formulario cuando el usuario es manager', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      userId: 'user-1',
      name: 'Manager Test',
      email: 'manager@test.com',
      role: 'regularUser' as never,
      isActive: true,
      tenantId: 'tenant-1',
      tenantRole: 'manager',
    } as never)

    const result = await NuevoProductosPage()

    expect(redirectMock).not.toHaveBeenCalled()
    expect(result).toBeTruthy()
  })
})
