import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const usePathname = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    section: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <section {...props}>{children}</section>
    ),
  },
}))

vi.mock('@/features/docs/components/docs-search', () => ({
  DocsSearch: () => <div data-testid="docs-search" />,
}))

import { DocsShell } from '@/features/docs/components/docs-shell'

describe('DocsShell', () => {
  it('marks the current docs module as active based on the pathname', () => {
    usePathname.mockReturnValue('/docs/productos')

    render(
      <DocsShell searchIndex={[]}>
        <div>Contenido</div>
      </DocsShell>,
    )

    expect(screen.getByRole('link', { name: 'Productos' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Índice General' })).not.toHaveAttribute('aria-current')
  })

  it('marks the modules map entry as active on /docs/modules', () => {
    usePathname.mockReturnValue('/docs/modules')

    render(
      <DocsShell searchIndex={[]}>
        <div>Contenido</div>
      </DocsShell>,
    )

    expect(screen.getByRole('link', { name: 'Mapa de módulos' })).toHaveAttribute('aria-current', 'page')
  })
})
