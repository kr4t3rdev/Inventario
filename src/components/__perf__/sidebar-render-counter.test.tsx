/**
 * @description Perfila el sidebar despues de las optimizaciones de Fase 5.
 *  Mide # de renders por componente en distintos escenarios.
 *
 * Es un archivo de instrumentacion, NO un test de comportamiento.
 * Corre con `pnpm vitest run src/components/__perf__`.
 *
 * Reglas:
 *  - No modifica AppSidebar2 ni NavMain. Instrumenta via wrappers.
 *  - Reporta los numeros en consola. NO falla salvo donde se valida el modelo.
 */
import React, { useRef, useState } from 'react'
import { render, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const motionState = vi.hoisted(() => ({
  reducedMotion: false,
  captures: [] as Array<{ tag: string; props: Record<string, unknown> }>,
}))

const authState = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  userInstance: 0,
}))

const pathnameState = vi.hoisted(() => ({
  pathname: '/busy/dashboard',
}))

const sidebarState = vi.hoisted(() => ({
  state: 'expanded' as 'expanded' | 'collapsed',
  isMobile: false,
}))

// Per-render counters recopilados por wrappers
type RenderCounters = {
  NavMain: number[]
  NavUser: number
  filteredGroupsIdentities: number
}
const counters: RenderCounters = {
  NavMain: [],
  NavUser: 0,
  filteredGroupsIdentities: 0,
}
const filteredGroupsRefs = new Set<object>()

function resetCounters() {
  counters.NavMain = []
  counters.NavUser = 0
  counters.filteredGroupsIdentities = 0
  filteredGroupsRefs.clear()
}vi.mock('framer-motion', () => {
  const motionProxy = new Proxy(
    {},
    {
      get: (_, tag: string) => {
        const Component = ({
          children,
          ...props
        }: React.PropsWithChildren<Record<string, unknown>>) => {
          motionState.captures.push({ tag, props })
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
  default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) =>
    React.createElement('a', { href, ...props }, children),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.pathname,
}))

// NavMain ORIGINAL — wrapper que cuenta renders por items array
vi.mock('@/components/nav-main', () => ({
  NavMain: ({ items }: { items: Array<{ title: string }> }) => {
    counters.NavMain.push(items.length)
    // Trackear identidad de items: si cambia referencia, contamos.
    const ref = useRef(items)
    if (ref.current !== items) {
      counters.filteredGroupsIdentities++
      ref.current = items
      filteredGroupsRefs.add(items)
    }
    return React.createElement('div', { 'data-testid': 'nav-main' })
  },
}))

vi.mock('@/components/nav-user', () => ({
  NavUser: () => {
    counters.NavUser++
    return React.createElement('div', { 'data-testid': 'nav-user' })
  },
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

function makeUser(planFeatures: Record<string, boolean> = {}) {
  return {
    role: 'regularUser',
    tenantRole: 'manager',
    tenantId: 't1',
    planName: 'Profesional',
    planFeatures,
  } as const
}

function Snapshot() {
  return {
    NavMainRenders: counters.NavMain.length,
    NavMainTotalItems: counters.NavMain.reduce((a, b) => a + b, 0),
    NavUser: counters.NavUser,
    filteredGroupsIdentities: counters.filteredGroupsIdentities,
    motionCaptures: motionState.captures.length,
  }
}

function reportDelta(label: string, before: ReturnType<typeof Snapshot>, after: ReturnType<typeof Snapshot>) {
  const delta = {
    NavMainRenders: after.NavMainRenders - before.NavMainRenders,
    NavMainTotalItems: after.NavMainTotalItems - before.NavMainTotalItems,
    NavUser: after.NavUser - before.NavUser,
    filteredGroupsIdentities: after.filteredGroupsIdentities - before.filteredGroupsIdentities,
    motionCaptures: after.motionCaptures - before.motionCaptures,
  }
   
  console.log(`[perf] ${label}:`, delta)
  return delta
}

describe('sidebar perf: Fase 5 post-optimizacion', () => {
  beforeEach(() => {
    motionState.captures = []
    motionState.reducedMotion = false
    pathnameState.pathname = '/busy/dashboard'
    sidebarState.state = 'expanded'
    sidebarState.isMobile = false
    resetCounters()
    authState.user = makeUser({ contabilidad: true, empleados: true, 'reportes-financieros': true })
  })

  afterEach(() => {
    authState.user = null
  })

  it('mount: N NavMain renders (1 por grupo visible)', async () => {
    const { AppSidebar2 } = await import('@/components/app-sidebar2')
    render(React.createElement(AppSidebar2))
    const snap = Snapshot()

    expect(snap.NavMainRenders).toBeGreaterThan(0)
     
    console.log('[perf] BASELINE mount:', snap)
  })

  it('cambio de planFeatures (mismo role, mismas keys, distinto valor) re-corre buildVisibleSidebarGroups?', async () => {
    const { AppSidebar2 } = await import('@/components/app-sidebar2')
    const { rerender } = render(React.createElement(AppSidebar2))
    const before = Snapshot()

    // Cambiar planFeatures para triggear re-render
    act(() => {
      authState.user = makeUser({
        contabilidad: true,
        empleados: true,
        'reportes-financieros': true,
        'ficha-costo': true, // nuevo feature
      })
    })
    rerender(React.createElement(AppSidebar2))
    const after = Snapshot()

    const delta = reportDelta('feature flag flip', before, after)
    expect(delta.NavMainRenders).toBeGreaterThan(0)
  })

  it('cambio de sidebar state (expand <-> collapsed) re-renderiza AppSidebar2', async () => {
    const { AppSidebar2 } = await import('@/components/app-sidebar2')
    const { rerender } = render(React.createElement(AppSidebar2))
    const before = Snapshot()

    act(() => {
      sidebarState.state = 'collapsed'
    })
    rerender(React.createElement(AppSidebar2))
    const after = Snapshot()

    reportDelta('sidebar toggle', before, after)
  })

  it('cambio de pathname re-renderiza', async () => {
    const { AppSidebar2 } = await import('@/components/app-sidebar2')
    const { rerender } = render(React.createElement(AppSidebar2))
    const before = Snapshot()

    act(() => {
      pathnameState.pathname = '/busy/products'
    })
    rerender(React.createElement(AppSidebar2))
    const after = Snapshot()

    reportDelta('pathname cambio', before, after)
  })

  it('re-render padre sin cambio de props relevantes dispara trabajo de todos modos', async () => {
    const { AppSidebar2 } = await import('@/components/app-sidebar2')
    let setExternal = (_v: number) => undefined as void
    const Parent = () => {
      const [n, setN] = React.useState(0)
      React.useEffect(() => { setExternal = setN }, [])
      return React.createElement(
        'div',
        null,
        React.createElement(AppSidebar2),
        React.createElement('span', { 'data-testid': 'parent-counter' }, String(n)),
      )
    }

    render(React.createElement(Parent))
    const before = Snapshot()

    act(() => {
      setExternal(1)
    })
    const after = Snapshot()

    reportDelta('re-render padre (no afecta auth/pathname/sidebar-state)', before, after)
  })

  it('SSR + initial cliente deben producir la misma cantidad de items', async () => {
    const { AppSidebar2 } = await import('@/components/app-sidebar2')
    resetCounters()
    motionState.captures = []
    authState.user = makeUser({ contabilidad: true, empleados: true })
    const ssrHtml = renderToString(React.createElement(AppSidebar2))
    const ssrSnap = Snapshot()

    resetCounters()
    motionState.captures = []
    render(React.createElement(AppSidebar2))
    const clientSnap = Snapshot()

     
    console.log('[perf] SSR vs initial client motion captures:', {
      ssrMotion: ssrSnap.motionCaptures,
      clientMotion: clientSnap.motionCaptures,
      htmlSize: ssrHtml.length,
    })
    expect(clientSnap.motionCaptures).toBe(ssrSnap.motionCaptures)
  })
})
