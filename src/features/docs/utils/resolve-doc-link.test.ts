import { describe, expect, it } from 'vitest'

import { resolveDocLink } from '@/features/docs/utils/resolve-doc-link'

describe('resolveDocLink', () => {
  it('convierte README relativos a rutas /docs amigables', () => {
    expect(resolveDocLink('./admin/README.md')).toBe('/docs/admin')
  })

  it('convierte subpaginas markdown a rutas /docs anidadas', () => {
    expect(resolveDocLink('./contabilidad/reconciliacion.md')).toBe(
      '/docs/contabilidad/reconciliacion',
    )
  })

  it('preserva anchors al convertir markdown relativo', () => {
    expect(resolveDocLink('./contabilidad/reconciliacion.md#pendientes')).toBe(
      '/docs/contabilidad/reconciliacion#pendientes',
    )
  })

  it('deja intactos links externos y anchors locales', () => {
    expect(resolveDocLink('https://example.com/guide.md')).toBe('https://example.com/guide.md')
    expect(resolveDocLink('#resumen')).toBe('#resumen')
  })
})
