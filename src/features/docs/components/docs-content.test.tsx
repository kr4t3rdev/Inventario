import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('framer-motion', () => ({
  motion: {
    article: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <article {...props}>{children}</article>
    ),
  },
}))

vi.mock('@/features/docs/components/mermaid-block', () => ({
  MermaidBlock: ({ chart }: { chart: string }) => <div data-testid="mermaid-block">{chart}</div>,
}))

import { DocsContent } from '@/features/docs/components/docs-content'

describe('DocsContent', () => {
  it('renderiza links markdown relativos como rutas internas de docs', () => {
    render({
      ...(<DocsContent content={'[Reconciliación](./contabilidad/reconciliacion.md#pendientes)'} />),
    })

    const link = screen.getByRole('link', { name: 'Reconciliación' })

    expect(link).toHaveAttribute('href', '/docs/contabilidad/reconciliacion#pendientes')
    expect(link).not.toHaveAttribute('target')
  })

  it('marca links externos para abrir en nueva pestaña', () => {
    render(<DocsContent content={'[OpenAI](https://openai.com)'} />)

    const link = screen.getByRole('link', { name: 'OpenAI' })

    expect(link).toHaveAttribute('href', 'https://openai.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
