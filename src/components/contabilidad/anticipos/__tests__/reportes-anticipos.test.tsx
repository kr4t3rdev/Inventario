import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'

describe('ReportesAnticipos', () => {
  it('no usa SelectItem con value vacío', () => {
    const file = readFileSync(
      '/Users/arturo/Documents/Proyecto Inventario/TCP/src/components/contabilidad/anticipos/reportes-anticipos.tsx',
      'utf8'
    )

    expect(file).not.toContain('<SelectItem value="">')
  })
})
