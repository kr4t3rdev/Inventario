import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DocsSidebar } from '@/features/docs/components/docs-sidebar'

describe('DocsSidebar', () => {
  it('includes a link to the modules map page', () => {
    render(<DocsSidebar />)

    expect(screen.getByRole('link', { name: 'Mapa de módulos' })).toHaveAttribute(
      'href',
      '/docs/modules',
    )
  })
})
