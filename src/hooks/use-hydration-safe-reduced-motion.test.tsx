import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const motionState = vi.hoisted(() => ({
  reducedMotion: false,
  mounted: false,
}))

vi.mock('framer-motion', () => ({
  useReducedMotion: () => motionState.reducedMotion,
}))

vi.mock('@/hooks/use-is-mounted', () => ({
  useIsMounted: () => motionState.mounted,
}))

import { useHydrationSafeReducedMotion } from './use-hydration-safe-reduced-motion'

function HookHarness(): React.ReactElement {
  const reduceMotion = useHydrationSafeReducedMotion()

  return <div data-testid="value">{String(reduceMotion)}</div>
}

describe('useHydrationSafeReducedMotion', () => {
  it('returns false before mount even if the user prefers reduced motion', () => {
    motionState.reducedMotion = true
    motionState.mounted = false

    render(<HookHarness />)

    expect(screen.getByTestId('value')).toHaveTextContent('false')
  })

  it('returns true after mount when the user prefers reduced motion', () => {
    motionState.reducedMotion = true
    motionState.mounted = true

    render(<HookHarness />)

    expect(screen.getByTestId('value')).toHaveTextContent('true')
  })
})
