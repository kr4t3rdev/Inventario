import { describe, expect, it } from 'vitest'

import { readDocsModulesIndexContent, readModuleContent } from '@/features/docs/utils/markdown'

describe('docs markdown readers', () => {
  it('reads the modules index markdown file', () => {
    const content = readDocsModulesIndexContent()

    expect(content).toContain('# Indice de Modulos')
    expect(content).toContain('./admin/README.md')
  })

  it('keeps reading regular module markdown files', () => {
    const content = readModuleContent('productos')

    expect(content).toBeTruthy()
    expect(content).toContain('# Productos')
  })
})
