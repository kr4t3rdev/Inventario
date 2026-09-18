import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/lib/auth/server-route-identity', () => ({
  getProtectedRouteIdentity: async () => ({ userId: 'user-1' }),
}))

vi.mock('@/lib/auth/sales-agent-access', () => ({
  resolveSalesAgentAccess: () => ({ allowed: true }),
}))

vi.mock('@/components/app-sidebar2', () => ({
  AppSidebar2: () => <aside>Menú</aside>,
}))

vi.mock('@/components/site-header', () => ({
  SiteHeader: () => <header>Cabecera</header>,
}))

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SidebarInset: ({ children }: React.PropsWithChildren) => <main>{children}</main>,
}))

vi.mock('sonner', () => ({
  Toaster: () => null,
}))

vi.mock('@/features/reviews', () => ({
  ReviewDialogProvider: () => null,
}))

import BusyLayout from './layout'

describe('BusyLayout', () => {
  it('expone un único landmark main mediante SidebarInset', async () => {
    render(await BusyLayout({ children: <p>Contenido</p> }))

    expect(screen.getAllByRole('main')).toHaveLength(1)
  })
})
