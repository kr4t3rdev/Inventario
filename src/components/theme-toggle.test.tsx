import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'dark',
    resolvedTheme: 'dark',
    setTheme: vi.fn(),
  }),
}))

import { ThemeToggle } from './theme-toggle'

describe('ThemeToggle', () => {
  it('nombra el control y mantiene un objetivo tactil de 44 px', async () => {
    render(<ThemeToggle />)

    const trigger = await screen.findByRole('button', { name: 'Cambiar tema' })
    expect(trigger).toHaveClass('size-11')
  })
})
