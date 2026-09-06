import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const featureRoot = path.join(process.cwd(), 'src/features/ficha-costo')
const actionFiles = fs.readdirSync(featureRoot)
  .filter((name) => /^actions-.+\.ts$/.test(name))
  .map((name) => ({ name, source: fs.readFileSync(path.join(featureRoot, name), 'utf8') }))

/** @description Cuenta ocurrencias literales de un boundary en un action file. */
function count(source: string, value: string): number {
  return source.split(value).length - 1
}

describe('Ficha de Costo action boundary', () => {
  it.each(actionFiles.map((file) => [file.name, file.source]))(
    'gates every tenant action in %s with the base feature',
    (_name, source) => {
      const strictBoundaries = count(
        source,
        "const tenantId = requireFichaCostoFeature(user, 'ficha-costo')",
      )
      expect(strictBoundaries).toBeGreaterThan(0)
      expect(source).not.toContain("requireFeature(user, 'ficha-costo',")
    },
  )

  it('requires permission after features in both bulk actions', () => {
    const source = actionFiles.find((file) => file.name === 'actions-bulk.ts')?.source ?? ''
    const basePositions = [...source.matchAll(/requireFichaCostoFeature\(user, 'ficha-costo'\)/g)].map((m) => m.index)
    const bulkPositions = [...source.matchAll(/requireFichaCostoFeature\(user, 'ficha-costo-bulk'\)/g)].map((m) => m.index)
    expect(basePositions).toHaveLength(2)
    expect(bulkPositions).toHaveLength(2)
    expect(basePositions.every((position, index) => position < bulkPositions[index])).toBe(true)
    const managerPositions = [...source.matchAll(/requirePermission\(user,/g)].map((m) => m.index)
    expect(managerPositions).toHaveLength(2)
    expect(bulkPositions.every((position, index) => position < managerPositions[index])).toBe(true)
  })

  it('requires both exact features before permission in suggestion mutation', () => {
    const source = actionFiles.find((file) => file.name === 'actions-sugerencias.ts')?.source ?? ''
    const mutation = source.slice(source.indexOf('export const aplicarSugerenciaPrecioAction'))
    const basePosition = mutation.indexOf("requireFichaCostoFeature(user, 'ficha-costo')")
    const bulkPosition = mutation.indexOf("requireFichaCostoFeature(user, 'ficha-costo-bulk')")
    const managerPosition = mutation.indexOf('requirePermission(user,')
    expect(basePosition).toBeGreaterThanOrEqual(0)
    expect(basePosition).toBeLessThan(bulkPosition)
    expect(bulkPosition).toBeLessThan(managerPosition)
  })
})
