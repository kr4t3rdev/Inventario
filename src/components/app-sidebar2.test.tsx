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
    user: {
      role: 'admin',
      tenantRole: 'manager',
      planFeatures: {
        empleados: true,
        nomina: true,
        asistencia: true,
        vacaciones: true,
      },
    },
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

vi.mock('./nav-main', () => ({
  NavMain: () => React.createElement('div', { 'data-testid': 'nav-main' }),
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
})
