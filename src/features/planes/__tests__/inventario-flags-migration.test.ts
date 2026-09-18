import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    'prisma/migrations/20260905130001_inventario_flags_plans/migration.sql',
  ),
  'utf8',
)

const NUCLEO = ['kardex', 'ajustes-inventario', 'conteo-fisico']
const P1 = [
  'ordenes-compra',
  'recepciones',
  'reabastecimiento',
  'unidades-conversion',
  'lotes-series',
  'variantes',
  'ubicaciones-avanzadas',
]

describe('Migración de flags de inventario a planes y licencias', () => {
  it('habilita el núcleo auditable en todos los planes y licencias', () => {
    expect(migration.match(/UPDATE "Plan"/g)?.length).toBeGreaterThanOrEqual(3)
    expect(migration.match(/UPDATE "tenant_licenses"/g)?.length).toBeGreaterThanOrEqual(3)
    for (const key of NUCLEO) {
      expect(migration).toContain(`"${key}": true`)
    }
  })

  it('restringe P1 a planes Profesional y Empresarial', () => {
    expect(migration).toContain(`"nombre" IN ('Profesional', 'Empresarial')`)
    for (const key of P1) {
      expect(migration).toContain(`"${key}": true`)
    }
  })

  it('reserva mrp-avanzado a Empresarial', () => {
    expect(migration).toContain('"mrp-avanzado": true')
    expect(migration).toContain(`AND "nombre" = 'Empresarial'`)
  })

  it('es idempotente y no destruye flags existentes', () => {
    // Solo usa merge jsonb (||) — nunca sobrescribe el objeto completo.
    expect(migration.match(/SET "features" = "features" \|\|/g)?.length).toBeGreaterThanOrEqual(2)
    expect(migration).toContain('jsonb_typeof("features") = \'object\'')
    expect(migration).not.toMatch(/SET "features" = '\{/)
  })
})
