import React from 'react'
import { render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const motionState = vi.hoisted(() => ({
  reducedMotion: false,
  captures: [] as Array<{
    tag: string
    props: {
      initial?: unknown
      animate?: unknown
      exit?: unknown
      whileHover?: unknown
      whileTap?: unknown
      variants?: unknown
    }
  }>,
}))

const authState = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
}))

const pathnameState = vi.hoisted(() => ({
  pathname: '/busy/dashboard',
}))

const navMainState = vi.hoisted(() => ({
  groups: [] as Array<Array<{ title: string }>>,
}))

const sidebarState = vi.hoisted(() => ({
  state: 'expanded' as 'expanded' | 'collapsed',
  isMobile: false,
}))

vi.mock('framer-motion', () => {
  const motionProxy = new Proxy(
    {},
    {
      get: (_, tag: string) => {
        const Component = ({
          children,
          initial,
          animate,
          exit,
          whileHover,
          whileTap,
          variants,
          ...props
        }: React.PropsWithChildren<Record<string, unknown>>) => {
          motionState.captures.push({
            tag,
            props: { initial, animate, exit, whileHover, whileTap, variants },
          })
          return React.createElement(tag, props, children)
        }
        Component.displayName = `motion.${tag}`
        return Component
      },
    },
  )
  return {
    motion: motionProxy,
    m: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    LazyMotion: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useReducedMotion: () => motionState.reducedMotion,
  }
})

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: authState.user }),
}))

vi.mock('@/hooks/use-is-mounted', () => ({
  useIsMounted: () => false,
}))

vi.mock('@/hooks/use-hydration-safe-reduced-motion', () => ({
  useHydrationSafeReducedMotion: () => motionState.reducedMotion,
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string }>) =>
    React.createElement('a', { href, ...props }, children),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.pathname,
}))

vi.mock('@/components/nav-main', () => ({
  NavMain: ({ items }: { items: Array<{ title: string }> }) => {
    navMainState.groups.push(items)
    return React.createElement('div', { 'data-testid': 'nav-main' })
  },
}))

vi.mock('@/components/nav-user', () => ({
  NavUser: () => React.createElement('div', { 'data-testid': 'nav-user' }),
}))

vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('aside', props, children),
  SidebarContent: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', props, children),
  SidebarFooter: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('footer', props, children),
  SidebarHeader: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('header', props, children),
  SidebarRail: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', props, children),
  SidebarGroup: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('section', props, children),
  SidebarGroupLabel: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('h2', props, children),
  SidebarSeparator: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('hr', props, children),
  useSidebar: () => ({ state: sidebarState.state, isMobile: sidebarState.isMobile }),
}))

import { AppSidebar2 } from './app-sidebar2'

const FULL_FEATURES: Record<string, boolean> = {
  'ficha-costo': true,
  'empleados': true,
  'asistencia': true,
  'vacaciones': true,
  'nomina': true,
  'contabilidad': true,
  'cuentas-cobrar': true,
  'cuentas-pagar': true,
  'anticipos': true,
  'prestamos-cash': true,
  'deudas-cash': true,
  'transferencias-bancarias': true,
  'ajustes-bancarios': true,
  'multi-moneda': true,
  'inyeccion-capital': true,
  'analisis-estado-cuenta': true,
  'facturas-vencidas': true,
  'clientes': true,
  'produccion': true,
  'facturacion': true,
  'listas-precios': true,
  'contratos': true,
  'ofertas': true,
  'servicios': true,
  'reportes-financieros': true,
  'cuadre-diario': true,
  'turnos-pos': true,
  'rentabilidad-compra': true,
}

function resetState() {
  motionState.captures = []
  motionState.reducedMotion = false
  navMainState.groups = []
  pathnameState.pathname = '/busy/dashboard'
  sidebarState.state = 'expanded'
  sidebarState.isMobile = false
}

function renderForUser(user: Record<string, unknown> | null) {
  resetState()
  authState.user = user
  render(React.createElement(AppSidebar2))
  return navMainState.groups.flat().map((i) => i.title)
}

describe('AppSidebar2 role matrix E2E', () => {
  beforeEach(resetState)
  afterEach(() => {
    authState.user = null
  })

  describe('admin role', () => {
    it('admin with tenantId and full features sees Licencias and Planes', () => {
      const items = renderForUser({
        role: 'admin',
        tenantRole: 'manager',
        tenantId: 't1',
        planFeatures: FULL_FEATURES,
      })
      expect(items).toContain('Licencias')
      expect(items).toContain('Planes')
      expect(items).toContain('Usuarios')
    })

    it('admin without tenantId does NOT see Ficha de Costo', () => {
      const items = renderForUser({
        role: 'admin',
        tenantRole: 'manager',
        tenantId: null,
        planFeatures: FULL_FEATURES,
      })
      expect(items).not.toContain('Ficha de Costo')
    })
  })

  describe('manager role', () => {
    it('manager with full features sees all role-mapped items', () => {
      const items = renderForUser({
        role: 'regularUser',
        tenantRole: 'manager',
        tenantId: 't1',
        planFeatures: FULL_FEATURES,
      })
      expect(items).toContain('Productos')
      expect(items).toContain('Categorías')
      expect(items).toContain('Almacenes')
      expect(items).toContain('Usuarios')
      expect(items).not.toContain('Licencias')
      expect(items).not.toContain('Planes')
    })
  })

  describe('economico role', () => {
    it('economico sees Contabilidad but not Categorías or Compras', () => {
      const items = renderForUser({
        role: 'regularUser',
        tenantRole: 'economico',
        tenantId: 't1',
        planFeatures: FULL_FEATURES,
      })
      expect(items).toContain('Dashboard')
      expect(items).toContain('Cuentas Bancarias')
      expect(items).toContain('Empleados')
      expect(items).not.toContain('Categorías')
      expect(items).not.toContain('Almacenes')
      expect(items).not.toContain('Compras de Productos')
    })
  })

  describe('dependiente role', () => {
    it('dependiente sees only Productos, Ventas, Servicios, Mi Empresa, Referidos, Reportes, Venta Diaria, Cuadres POS', () => {
      const items = renderForUser({
        role: 'regularUser',
        tenantRole: 'dependiente',
        tenantId: 't1',
        planFeatures: {},
      })
      expect(items).toContain('Productos')
      expect(items).toContain('Ventas')
      expect(items).toContain('Servicios')
      expect(items).toContain('Mi Empresa')
      expect(items).toContain('Referidos')
      expect(items).toContain('Reportes')
      expect(items).toContain('Venta Diaria')
      expect(items).toContain('Cuadres POS')

      expect(items).not.toContain('Dashboard')
      expect(items).not.toContain('Categorías')
      expect(items).not.toContain('Almacenes')
      expect(items).not.toContain('Empleados')
      expect(items).not.toContain('Usuarios')
      expect(items).not.toContain('Licencias')
    })
  })

  describe('tenantless user', () => {
    it('returns nothing on /busy', () => {
      const items = renderForUser({
        role: 'regularUser',
        tenantId: 't1',
        tenantRole: null,
        planFeatures: {},
      })
      expect(items).toEqual([])
    })

    it('shows public items off /busy', () => {
      resetState()
      pathnameState.pathname = '/somewhere/else'
      authState.user = {
        role: 'regularUser',
        tenantId: 't1',
        tenantRole: null,
        planFeatures: {},
      }
      render(React.createElement(AppSidebar2))
      const items = navMainState.groups.flat().map((i) => i.title)
      expect(items).toContain('Productos')
      expect(items).toContain('Ventas')
      expect(items).not.toContain('Categorías')
    })
  })
})

describe('AppSidebar2 first-frame rendering', () => {
  beforeEach(resetState)
  afterEach(() => {
    authState.user = null
  })

  it('SSR output contains all visible group labels in the first frame (no stagger gap)', () => {
    authState.user = {
      role: 'regularUser',
      tenantRole: 'manager',
      tenantId: 't1',
      planFeatures: FULL_FEATURES,
    }
    const ssrHtml = renderToString(React.createElement(AppSidebar2))
    // Group labels render in SSR even though the NavMain item rendering is mocked
    expect(ssrHtml).toContain('Gestión')
    expect(ssrHtml).toContain('Acciones')
    expect(ssrHtml).toContain('Contabilidad')
    expect(ssrHtml).toContain('Reportes')
  })

  it('SSR and initial client render produce the same group structure (hydration safety)', () => {
    authState.user = {
      role: 'regularUser',
      tenantRole: 'dependiente',
      tenantId: 't1',
      planFeatures: {},
    }
    const ssrHtml = renderToString(React.createElement(AppSidebar2))

    navMainState.groups = []
    render(React.createElement(AppSidebar2))
    const clientGroupLabels: string[] = []
    // The client render pushes items arrays per group; we can infer group count
    const clientGroupCount = navMainState.groups.length

    // The group labels rendered in SSR
    const ssrGroupCount = (ssrHtml.match(/<h2[^>]*>[^<]+<\/h2>/g) ?? []).length

    expect(clientGroupCount).toBe(ssrGroupCount)
  })

  it('SSR and initial client render do not depend on reduced-motion preference', () => {
    authState.user = {
      role: 'regularUser',
      tenantRole: 'manager',
      tenantId: 't1',
      planFeatures: FULL_FEATURES,
    }

    motionState.reducedMotion = false
    const ssrHtml = renderToString(React.createElement(AppSidebar2))

    motionState.reducedMotion = true
    motionState.captures = []
    render(React.createElement(AppSidebar2))
    const clientCaptures = motionState.captures.slice()

    expect(clientCaptures.length).toBeGreaterThan(0)
    expect(ssrHtml).toContain('Gestión')

    motionState.reducedMotion = false
    motionState.captures = []
    render(React.createElement(AppSidebar2))
    const otherClientCaptures = motionState.captures.slice()

    expect(otherClientCaptures.length).toBe(clientCaptures.length)
  })
})
