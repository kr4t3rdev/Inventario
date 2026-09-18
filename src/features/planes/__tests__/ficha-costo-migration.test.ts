import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'prisma/migrations/20260716120000_ficha_costo_enterprise_only/migration.sql'),
  'utf8',
)

describe('Ficha de Costo Enterprise-only migration', () => {
  it('uses the physical table names declared by Prisma', () => {
    expect(schema).toMatch(/model Plan \{[\s\S]*?\n\}/)
    expect(schema).not.toMatch(/model Plan \{[\s\S]*?@@map\("plans"\)[\s\S]*?\n\}/)
    expect(migration).toContain('UPDATE "Plan"')
    expect(migration).toContain('LEFT JOIN "Plan" AS plan')
    expect(migration).not.toContain('"plans"')
    expect(migration).toContain('UPDATE "tenant_licenses"')
  })

  it('defaults unlinked and unknown licenses to denied snapshots', () => {
    expect(migration).toContain('LEFT JOIN "Plan"')
    expect(migration).toContain("COALESCE(license_plans.\"planNombre\", '')")
    expect(migration).toMatch(/UPDATE "tenant_licenses"[\s\S]*?"ficha-costo": false/)
    expect(migration).toContain("- 'ficha-costo' - 'ficha-costo-bulk'")
  })

  it('normalizes non-object JSON while preserving unrelated object keys', () => {
    expect(migration.match(/jsonb_typeof\([^)]*"features"\) = 'object'/g)?.length).toBeGreaterThanOrEqual(2)
    expect(migration).toContain("ELSE '{}'::jsonb END)")
    expect(migration).toContain('SET "features" = CASE')
    expect(migration).toContain('ELSE "features"')
    expect(migration).toContain("|| '{\"ficha-costo\": true, \"ficha-costo-bulk\": true}'::jsonb")
    expect(migration).toContain("|| '{\"ficha-costo\": false, \"ficha-costo-bulk\": false}'::jsonb")
  })
})

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null

/** @description Modelo conceptual de la política JSONB expresada por la migración SQL. */
function applyLicensePolicy(planName: string | null, features: JsonValue, overrides: JsonValue) {
  const objectFeatures = features && typeof features === 'object' && !Array.isArray(features)
    ? features as Record<string, unknown>
    : {}
  const objectOverrides = overrides && typeof overrides === 'object' && !Array.isArray(overrides)
    ? overrides as Record<string, unknown>
    : {}
  const enterprise = ['empresarial', 'enterprise'].includes(planName?.toLowerCase() ?? '')
  const { ['ficha-costo']: _base, ['ficha-costo-bulk']: _bulk, ...safeOverrides } = objectOverrides
  return {
    features: {
      ...objectFeatures,
      'ficha-costo': enterprise,
      'ficha-costo-bulk': enterprise,
    },
    featureOverrides: safeOverrides,
  }
}

describe('Ficha de Costo legacy snapshot policy', () => {
  it.each([
    ['null plan', null, null],
    ['unknown plan', 'Personalizado', ['invalid']],
    ['string JSON', null, 'invalid'],
  ])('denies %s and normalizes non-object JSON', (_case, planName, features) => {
    expect(applyLicensePolicy(planName, features, {
      keep: true,
      'ficha-costo': true,
      'ficha-costo-bulk': true,
    })).toEqual({
      features: { 'ficha-costo': false, 'ficha-costo-bulk': false },
      featureOverrides: { keep: true },
    })
  })

  it('enables linked Enterprise snapshots and is idempotent', () => {
    const first = applyLicensePolicy('Enterprise', { keep: 'value' }, {
      keepOverride: false,
      'ficha-costo': false,
    })
    const second = applyLicensePolicy('Enterprise', first.features, first.featureOverrides)
    expect(second).toEqual(first)
    expect(second.features).toEqual({
      keep: 'value',
      'ficha-costo': true,
      'ficha-costo-bulk': true,
    })
    expect(second.featureOverrides).toEqual({ keepOverride: false })
  })
})
