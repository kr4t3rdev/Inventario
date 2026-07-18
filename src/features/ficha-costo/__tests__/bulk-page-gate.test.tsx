import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }))
const redirectMock = vi.hoisted(() => vi.fn((href: string) => { throw new Error(`REDIRECT:${href}`) }))
const findManyMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser: vi.fn(() => state.user) }))
vi.mock('@/lib/prisma', () => ({ prisma: { producto: { findMany: findManyMock } } }))
vi.mock('@/components/app-sidebar2', () => ({ AppSidebar2: () => React.createElement('aside') }))
vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: React.PropsWithChildren) => React.createElement('div', null, children),
  SidebarInset: ({ children }: React.PropsWithChildren) => React.createElement('main', null, children),
}))
vi.mock('../components/bulk-price-manager', () => ({ BulkPriceManager: () => React.createElement('div') }))

import BulkPricePage from '@/app/busy/ficha-costo/bulk/page'

describe('BulkPricePage tenant-scoped gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findManyMock.mockResolvedValue([])
  })

  it('redirects global admin without tenant to admin panel before Prisma', async () => {
    state.user = { role: 'admin', tenantId: null, planFeatures: {} }
    await expect(BulkPricePage()).rejects.toThrow('REDIRECT:/admin')
    expect(findManyMock).not.toHaveBeenCalled()
  })

  it('redirects global admin on a Basic tenant before Prisma', async () => {
    state.user = { role: 'admin', tenantId: 'tenant-admin', planFeatures: {} }
    await expect(BulkPricePage()).rejects.toThrow('REDIRECT:/busy/dashboard')
    expect(findManyMock).not.toHaveBeenCalled()
  })

  it('allows global admin on an Enterprise tenant', async () => {
    state.user = {
      role: 'admin',
      tenantId: 'tenant-admin',
      planFeatures: { 'ficha-costo': true, 'ficha-costo-bulk': true },
    }
    await expect(BulkPricePage()).resolves.toBeTruthy()
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-admin' },
    }))
  })

  it('redirects a tenant without both features before Prisma', async () => {
    state.user = { role: 'regularUser', tenantId: 'tenant-1', planFeatures: { 'ficha-costo': true } }
    await expect(BulkPricePage()).rejects.toThrow('REDIRECT:/busy/dashboard')
    expect(findManyMock).not.toHaveBeenCalled()
  })
})
