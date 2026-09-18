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
      whileFocus?: unknown
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
          whileFocus,
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
              whileFocus,
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

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string }>) =>
    React.createElement('a', { href, ...props }, children),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    login: vi.fn(),
  }),
}))

vi.mock('@/components/auth/auth-layout', () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}))

import LoginPage from './page'

describe('LoginPage hydration-safe motion', () => {
  it('keeps the first render motion props stable when reduced-motion changes before mount', () => {
    motionState.reducedMotion = false
    motionState.captures = []

    renderToString(React.createElement(LoginPage))
    const serverSnapshot = motionState.captures.slice()

    expect(serverSnapshot.length).toBeGreaterThan(0)

    motionState.reducedMotion = true
    motionState.captures = []

    render(React.createElement(LoginPage))
    const clientInitialSnapshot = motionState.captures.slice(0, serverSnapshot.length)

    expect(clientInitialSnapshot).toEqual(serverSnapshot)
  })
})
