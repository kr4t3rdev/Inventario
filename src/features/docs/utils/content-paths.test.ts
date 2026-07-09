import { describe, expect, it } from 'vitest'

import { DOCS_MODULES_DIR, DOCS_MODULES_INDEX_PATH } from '@/features/docs/utils/content-paths'

describe('docs content paths', () => {
  it('points the public docs content to content/docs/modules', () => {
    expect(DOCS_MODULES_DIR).toContain('content/docs/modules')
    expect(DOCS_MODULES_INDEX_PATH).toContain('content/docs/modules/INDEX.md')
  })
})
