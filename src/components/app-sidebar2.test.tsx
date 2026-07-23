import React from 'react'
import { render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

type MotionCapture = {
  tag: string
  props: {
    initial?: unknown
    animate?: unknown
    exit?: unknown
    whileHover?: unknown
    whileTap?: unknown
    variants?: unknown
  }
}

const motionState = vi.hoisted(() => ({
  reducedMotion: false,
  captures: [] as MotionCapture[],
}))

const authState = vi.hoisted(() => ({
  user: {
    role: 'admin',
    tenantRole: 'manager',
    planFeatures: {
      empleados: true,
      nomina: true,
      asistencia: true,
      vacaciones: true,
    },
  } as Record<string, unknown> | null,
}))

const pathnameState = vi.hoisted(() => ({
  pathname: '/busy/dashboard',
}))

const navMainState = vi.hoisted(() => ({
  groups: [] as Array<Array<{ title: string }>>,
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
            props: {
              initial,
              animate,
              exit,
              whileHover,
              whileTap,
              variants,
            },
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
  useAuth: () => ({
    user: authState.user,
  }),
}))

vi.mock('@/hooks/use-is-mounted', () => ({
  useIsMounted: () => false,
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

vi.mock('./nav-main', () => ({
  NavMain: ({ items }: { items: Array<{ title: string }> }) => {
    navMainState.groups.push(items)
    return React.createElement('div', { 'data-testid': 'nav-main' })
  },
}))

vi.mock('./nav-user', () => ({
  NavUser: () => React.createElement('div', { 'data-testid': 'nav-user' }),
}))

vi.mock('./ui/sidebar', () => ({
  Sidebar: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('aside', props, children),
  SidebarContent: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', props, children),
  SidebarFooter: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('footer', props, children),
  SidebarHeader: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('header', props, children),
  SidebarRail: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', props, children),
  SidebarGroup: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('section', props, children),
  SidebarGroupLabel: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('h2', props, children),
  SidebarSeparator: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('hr', props, children),
  useSidebar: () => ({
    state: 'expanded',
    isMobile: false,
  }),
}))

import { AppSidebar2, TENANTLESS_PUBLIC_ITEMS } from './app-sidebar2'

describe('AppSidebar2 hydration-safe motion', () => {
  beforeEach(() => {
    motionState.captures = []
    navMainState.groups = []
    pathnameState.pathname = '/busy/dashboard'
    authState.user = {
      role: 'admin',
      tenantRole: 'manager',
      planFeatures: {
        empleados: true,
        nomina: true,
        asistencia: true,
        vacaciones: true,
      },
    }
  })

  it('keeps the first render motion props stable when reduced-motion changes before mount', () => {
    motionState.reducedMotion = false
    motionState.captures = []

    renderToString(React.createElement(AppSidebar2))
    const serverSnapshot = motionState.captures.slice()

    expect(serverSnapshot.length).toBeGreaterThan(0)

    motionState.reducedMotion = true
    motionState.captures = []

    render(React.createElement(AppSidebar2))
    const clientInitialSnapshot = motionState.captures.slice(0, serverSnapshot.length)

    expect(clientInitialSnapshot).toEqual(serverSnapshot)
  })

  it('does not expose Clientes or Servicios in tenantless degraded mode allowlist', () => {
    expect(TENANTLESS_PUBLIC_ITEMS.has('Clientes')).toBe(false)
    expect(TENANTLESS_PUBLIC_ITEMS.has('Servicios')).toBe(false)
    expect(TENANTLESS_PUBLIC_ITEMS.has('Productos')).toBe(true)
    expect(TENANTLESS_PUBLIC_ITEMS.has('Ventas')).toBe(true)
  })

  it('does not render degraded tenantless items on /busy routes when tenantRole is missing', () => {
    authState.user = {
      role: 'regularUser',
      tenantId: 'tenant-1',
      tenantRole: undefined,
      planFeatures: {
        productos: true,
        dashboard: true,
        reportes: true,
      },
    }

    render(React.createElement(AppSidebar2))

    const renderedItems = navMainState.groups.flat().map((item) => item.title)
    expect(renderedItems).toEqual([])
  })

  it('hides the operational link for a global admin without active tenant', () => {
    authState.user = { role: 'admin', tenantId: undefined, tenantRole: undefined, planFeatures: {} }
    render(React.createElement(AppSidebar2))
    expect(navMainState.groups.flat().map((item) => item.title)).not.toContain('Ficha de Costo')
  })
})

describe('AppSidebar2 Ficha de Costo plan gate', () => {
  beforeEach(() => {
    navMainState.groups = []
    authState.user = {
      role: 'regularUser',
      tenantId: 'tenant-1',
      tenantRole: 'manager',
      planFeatures: { 'reportes-financieros': true },
    }
  })

  it('hides Ficha de Costo when the feature is false or missing', () => {
    render(React.createElement(AppSidebar2))
    expect(navMainState.groups.flat().map((item) => item.title)).not.toContain('Ficha de Costo')
  })

  it('shows Ficha de Costo when the feature is enabled', () => {
    authState.user = {
      ...authState.user,
      planFeatures: { 'reportes-financieros': true, 'ficha-costo': true },
    }
    render(React.createElement(AppSidebar2))
    expect(navMainState.groups.flat().map((item) => item.title)).toContain('Ficha de Costo')
  })

  it('hides Ficha de Costo from a global admin on a Basic tenant', () => {
    authState.user = { role: 'admin', tenantId: 'tenant-admin', tenantRole: 'manager', planFeatures: {} }
    render(React.createElement(AppSidebar2))
    expect(navMainState.groups.flat().map((item) => item.title)).not.toContain('Ficha de Costo')
  })

  it('shows Ficha de Costo to a global admin on an Enterprise tenant', () => {
    authState.user = {
      role: 'admin',
      tenantId: 'tenant-admin',
      tenantRole: 'manager',
      planFeatures: { 'ficha-costo': true },
    }
    render(React.createElement(AppSidebar2))
    expect(navMainState.groups.flat().map((item) => item.title)).toContain('Ficha de Costo')
  })
})

describe('AppSidebar2 entrance animation', () => {
  beforeEach(() => {
    motionState.captures = []
    motionState.reducedMotion = false
    navMainState.groups = []
    pathnameState.pathname = '/busy/dashboard'
    authState.user = {
      role: 'admin',
      tenantRole: 'manager',
      planFeatures: { empleados: true },
    }
  })

  it('does not use any stagger or per-item transition variants', () => {
    render(React.createElement(AppSidebar2))
    for (const cap of motionState.captures) {
      if (cap.props.variants && typeof cap.props.variants === 'object') {
        const variants = cap.props.variants as Record<string, { transition?: Record<string, unknown> }>
        for (const key of Object.keys(variants)) {
          const transition = variants[key]?.transition
          if (transition && typeof transition === 'object') {
            expect(transition).not.toHaveProperty('staggerChildren')
            expect(transition).not.toHaveProperty('delayChildren')
          }
        }
      }
    }
  })
})
