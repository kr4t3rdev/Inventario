import React from 'react'
import { vi } from 'vitest'

// Polyfill para Pointer Events que no soporta JSDOM (necesario para Radix UI Select)
if (typeof window !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn()
  }
}

// Mock de ResizeObserver para JSDOM
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock de matchMedia
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) => {
        const Component = ({
          children,
          whileHover,
          whileTap,
          initial,
          animate,
          exit,
          transition,
          variants,
          ...props
        }: React.HTMLAttributes<HTMLElement> & Record<string, unknown>) =>
          React.createElement(tag, props, children)
        Component.displayName = `motion.${tag}`
        return Component
      },
    },
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useReducedMotion: vi.fn(() => false),
}))
