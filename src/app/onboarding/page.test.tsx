import React from 'react'
import { render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

const routerReplaceMock = vi.hoisted(() => vi.fn())

function createStateTuple<T>(
  value: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  return [value, vi.fn() as React.Dispatch<React.SetStateAction<T>>]
}

async function loadOnboardingPage() {
  vi.resetModules()

  vi.doMock('react', async () => {
    const actual = await vi.importActual<typeof import('react')>('react')
    let callIndex = 0

    const user = {
      userId: 'u-1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      onboardingType: 'worker',
      onboardingStatus: 'pending',
      emailVerifiedAt: null,
    }

    const tenants = [
      {
        tenantId: 'tenant-1',
        nombre: 'Acme SA',
        slug: 'acme',
      },
    ]

    return {
      ...actual,
      useState: <T,>(initial: T) => {
        callIndex += 1

        switch (callIndex) {
          case 1:
            return createStateTuple(user) as [T, React.Dispatch<React.SetStateAction<T>>]
          case 2:
            return createStateTuple(tenants) as [T, React.Dispatch<React.SetStateAction<T>>]
          case 3:
            return createStateTuple(false) as [T, React.Dispatch<React.SetStateAction<T>>]
          case 4:
            return createStateTuple<string | null>(null) as [T, React.Dispatch<React.SetStateAction<T>>]
          case 5:
            return createStateTuple<string | null>(null) as [T, React.Dispatch<React.SetStateAction<T>>]
          default:
            return createStateTuple(initial)
        }
      },
    }
  })

  vi.doMock('framer-motion', () => {
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

  vi.doMock('next/navigation', () => ({
    useRouter: () => ({
      replace: routerReplaceMock,
    }),
  }))

  vi.doMock('@/hooks/use-is-mounted', () => ({
    useIsMounted: () => false,
  }))

  vi.doMock('@/hooks/use-hydration-safe-reduced-motion', () => ({
    useHydrationSafeReducedMotion: () => motionState.reducedMotion,
  }))

  return (await import('./page')).default
}

describe('OnboardingPage hydration-safe motion', () => {
  afterEach(() => {
    routerReplaceMock.mockReset()
    motionState.captures = []
  })

  it('keeps the first render motion props stable when reduced-motion changes before mount', async () => {
    motionState.reducedMotion = false
    const ServerPage = await loadOnboardingPage()

    renderToString(React.createElement(ServerPage))
    const serverSnapshot = motionState.captures.slice()

    expect(serverSnapshot.length).toBeGreaterThan(0)

    motionState.reducedMotion = true
    motionState.captures = []
    const ClientPage = await loadOnboardingPage()

    render(React.createElement(ClientPage))
    const clientInitialSnapshot = motionState.captures.slice(0, serverSnapshot.length)

    expect(clientInitialSnapshot).toEqual(serverSnapshot)
  })
})
